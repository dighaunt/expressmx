'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@expressmx/validations';
import { withTransaction } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { formatMoneda } from '@/lib/dashboard/format';
import {
  reconcilePayment,
  markPaymentManuallyFailed,
} from '@/lib/payments/reconcile';

interface ActionResult {
  ok: boolean;
  message?: string;
  tareaId?: string;
}

const CrearInput = z.object({
  ticketId: z.string().uuid(),
  pagoId: z.string().uuid(),
  motivo: z.string().trim().min(10, 'Describe brevemente el motivo (10+ caracteres)').max(500),
});

interface PagoBasico {
  id: string;
  orden_id: string;
  payment_intent_id: string | null;
  estatus: string;
  monto: string;
}

interface TicketBasico {
  id: string;
  estatus: string;
  usuario_id: string;
  categoria: string;
  orden_id: string | null;
}

export async function crearTareaInvestigacionPago(
  input: z.infer<typeof CrearInput>,
): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.pago.investigar');
  const parsed = CrearInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { ticketId, pagoId, motivo } = parsed.data;

  return await withTransaction(async (tx) => {
    const ticket = await tx.queryOne<TicketBasico>(
      `SELECT id, estatus::text AS estatus, usuario_id, categoria::text AS categoria, orden_id
         FROM tickets_soporte WHERE id = $1`,
      [ticketId],
    );
    if (!ticket) return { ok: false, message: 'Ticket no encontrado' };
    if (ticket.estatus === 'resuelto' || ticket.estatus === 'cerrado') {
      return { ok: false, message: 'No se pueden crear tareas en un ticket cerrado' };
    }

    const pago = await tx.queryOne<PagoBasico>(
      `SELECT p.id, p.orden_id, p.payment_intent_id,
              p.estatus::text AS estatus, p.monto::text AS monto
         FROM pagos p
         JOIN ordenes_servicio o ON o.id = p.orden_id
        WHERE p.id = $1 AND o.cliente_id = $2`,
      [pagoId, ticket.usuario_id],
    );
    if (!pago) {
      return { ok: false, message: 'Pago no encontrado o no pertenece a este cliente' };
    }
    if (pago.estatus === 'procesado' || pago.estatus === 'reembolsado') {
      return {
        ok: false,
        message: 'Este pago ya está reconciliado; usa la acción de reembolso si corresponde',
      };
    }

    const pendiente = await tx.queryOne<{ id: string }>(
      `SELECT id FROM tareas_caso
        WHERE ticket_id = $1
          AND tipo = 'investigacion_pago'::tipo_tarea_caso
          AND estado IN ('abierta','en_progreso')
          AND payload->>'pago_id' = $2`,
      [ticketId, pagoId],
    );
    if (pendiente) {
      return {
        ok: false,
        message: 'Ya hay una investigación abierta para este pago',
        tareaId: pendiente.id,
      };
    }

    const asunto = `Investigar pago ${formatMoneda(pago.monto, true)} (intent ${(pago.payment_intent_id ?? 'sin intent').slice(0, 16)}...)`;

    const tarea = await tx.queryOne<{ id: string }>(
      `INSERT INTO tareas_caso
         (ticket_id, tipo, asunto, descripcion_md, payload,
          grupo_asignado, creado_por, bloqueante)
       VALUES ($1, 'investigacion_pago'::tipo_tarea_caso, $2, $3, $4::jsonb,
               'finanzas_l2', $5, true)
       RETURNING id`,
      [
        ticketId,
        asunto,
        motivo,
        JSON.stringify({
          pago_id: pagoId,
          payment_intent_id: pago.payment_intent_id,
          orden_id: pago.orden_id,
          monto: pago.monto,
          estatus_inicial: pago.estatus,
        }),
        viewer.userId,
      ],
    );
    if (!tarea) return { ok: false, message: 'No pudimos crear la tarea' };

    await tx.query(
      `UPDATE tickets_soporte
          SET action_status = 'esperando_finanzas'::action_status_ticket,
              action_status_motivo = $1,
              action_status_desde = NOW(),
              updated_at = NOW()
        WHERE id = $2`,
      [`Finanzas investigando pago ${formatMoneda(pago.monto, true)}`, ticketId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.pago.investigar.solicitada',
      entidad: 'tareas_caso',
      entidadId: tarea.id,
      valorNuevo: {
        ticket_id: ticketId,
        pago_id: pagoId,
        payment_intent_id: pago.payment_intent_id,
        motivo,
      },
      ticketId,
    });

    revalidatePath(`/dashboard/soporte/ticket/${ticketId}`);
    revalidatePath('/dashboard/finanzas/tareas-bandeja');
    return { ok: true, tareaId: tarea.id };
  });
}

const ResolverInput = z.object({
  tareaId: z.string().uuid(),
  decision: z.enum(['cobro_real', 'cobro_fallido']),
  notas: z.string().trim().min(10, 'Notas mínimas 10 caracteres').max(2000),
});

export async function resolverInvestigacionPago(
  input: z.infer<typeof ResolverInput>,
): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.tarea.completar');
  const parsed = ResolverInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { tareaId, decision, notas } = parsed.data;

  const isFinanzas = tienePermiso(viewer, 'reembolsos.aprobar') || tienePermiso(viewer, 'roles.gestionar');
  if (!isFinanzas) {
    return {
      ok: false,
      message: 'Solo finanzas (o super_admin) puede resolver una investigación de pago',
    };
  }

  const ticketIdToRevalidate = await withTransaction(async (tx) => {
    const tarea = await tx.queryOne<{
      id: string;
      ticket_id: string;
      tipo: string;
      estado: string;
      payload: Record<string, unknown>;
    }>(
      `SELECT id, ticket_id, tipo::text AS tipo, estado::text AS estado, payload
         FROM tareas_caso WHERE id = $1 FOR UPDATE`,
      [tareaId],
    );
    if (!tarea) throw new Error('Tarea no encontrada');
    if (tarea.tipo !== 'investigacion_pago') {
      throw new Error('Esta acción solo aplica a tareas de tipo investigacion_pago');
    }
    if (tarea.estado === 'completada' || tarea.estado === 'cancelada') {
      throw new Error('La tarea ya fue cerrada');
    }

    const pagoId = typeof tarea.payload?.pago_id === 'string' ? tarea.payload.pago_id : null;
    if (!pagoId) throw new Error('La tarea no tiene pago_id en payload');

    let resultadoMd: string;

    if (decision === 'cobro_real') {
      const recon = await reconcilePayment(pagoId, 'manual');
      if (recon.status === 'processed' || recon.status === 'duplicate') {
        resultadoMd = `[Cobro confirmado vs Stripe — ${recon.stripeStatus ?? 'sin status'}]\n\n${notas}`;
      } else if (recon.status === 'unhandled') {
        throw new Error(
          `Stripe aún no reporta el cobro como resolutivo (status='${recon.stripeStatus}'). ` +
            'Espera unos minutos o marca como no cobrado si el cliente confirma.',
        );
      } else if (recon.status === 'no_intent') {
        throw new Error(
          'El pago no tiene payment_intent_id; reconcilía manualmente o marca como no cobrado',
        );
      } else {
        throw new Error(recon.message ?? 'No pudimos reconciliar con Stripe');
      }
    } else {
      const marked = await markPaymentManuallyFailed(pagoId, notas);
      if (!marked.ok) throw new Error(marked.message ?? 'No pudimos marcar el pago como fallido');
      resultadoMd = `[Cobro NO realizado — marcado fallido manualmente]\n\n${notas}`;
    }

    await tx.query(
      `UPDATE tareas_caso
          SET estado = 'completada',
              completada_at = NOW(),
              completada_por = $1,
              resultado_md = $2,
              updated_at = NOW()
        WHERE id = $3`,
      [viewer.userId, resultadoMd, tareaId],
    );

    const otrasBloqueantes = await tx.queryOne<{ total: number }>(
      `SELECT COUNT(*)::INT AS total
         FROM tareas_caso
        WHERE ticket_id = $1
          AND bloqueante = true
          AND estado IN ('abierta','en_progreso')`,
      [tarea.ticket_id],
    );

    if (otrasBloqueantes && otrasBloqueantes.total === 0) {
      await tx.query(
        `UPDATE tickets_soporte
            SET action_status = NULL,
                action_status_motivo = NULL,
                action_status_desde = NULL,
                updated_at = NOW()
          WHERE id = $1
            AND action_status = 'esperando_finanzas'::action_status_ticket`,
        [tarea.ticket_id],
      );
    }

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.pago.investigar.resuelta',
      entidad: 'tareas_caso',
      entidadId: tareaId,
      valorAnterior: { estado: tarea.estado },
      valorNuevo: {
        decision,
        pago_id: pagoId,
        notas,
      },
      ticketId: tarea.ticket_id,
    });

    return tarea.ticket_id;
  });

  revalidatePath(`/dashboard/soporte/ticket/${ticketIdToRevalidate}`);
  revalidatePath(`/dashboard/finanzas/tareas-bandeja`);
  revalidatePath(`/dashboard/finanzas/tareas-bandeja/${tareaId}`);
  return { ok: true, tareaId };
}
