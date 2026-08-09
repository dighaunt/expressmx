'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@expressmx/validations';
import { withTransaction, type Tx } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { formatMoneda } from '@/lib/dashboard/format';

interface ActionResult {
  ok: boolean;
  message?: string;
  reembolsoId?: string | undefined;
  aprobacionId?: string | undefined;
  autoAprobado?: boolean | undefined;
}

const Input = z.object({
  ticketId: z.string().uuid(),
  pagoId: z.string().uuid(),
  monto: z.number().positive().max(100000),
  motivo: z.string().trim().min(10, 'Motivo mínimo 10 caracteres').max(2000),
});

async function getUmbralExpressMxn(tx: Tx): Promise<number> {
  const row = await tx.queryOne<{ valor: string }>(
    `SELECT valor FROM config_sistema WHERE clave = 'reembolso_express_max_mxn'`,
  );
  const parsed = row ? Number(row.valor) : 500;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 500;
}

export async function solicitarReembolsoInline(
  input: z.infer<typeof Input>,
): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.reembolso.solicitar_inline');
  const parsed = Input.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { ticketId, pagoId, monto, motivo } = parsed.data;

  return await withTransaction(async (tx) => {
    const ticket = await tx.queryOne<{ id: string; estatus: string; usuario_id: string }>(
      `SELECT id, estatus::text AS estatus, usuario_id
         FROM tickets_soporte WHERE id = $1`,
      [ticketId],
    );
    if (!ticket) return { ok: false, message: 'Ticket no encontrado' };
    if (ticket.estatus === 'resuelto' || ticket.estatus === 'cerrado') {
      return { ok: false, message: 'No se pueden crear reembolsos en un ticket cerrado' };
    }

    const pago = await tx.queryOne<{
      id: string;
      monto: string;
      estatus: string;
      orden_cliente_id: string;
    }>(
      `SELECT p.id, p.monto::text AS monto, p.estatus::text AS estatus,
              o.cliente_id AS orden_cliente_id
         FROM pagos p
         JOIN ordenes_servicio o ON o.id = p.orden_id
        WHERE p.id = $1`,
      [pagoId],
    );
    if (!pago) return { ok: false, message: 'Pago no encontrado' };
    if (pago.orden_cliente_id !== ticket.usuario_id) {
      return { ok: false, message: 'Ese pago no pertenece al cliente del ticket' };
    }
    if (pago.estatus !== 'procesado') {
      return {
        ok: false,
        message: `Solo se pueden reembolsar pagos procesados (actual: ${pago.estatus})`,
      };
    }
    const montoPago = Number(pago.monto);
    if (monto > montoPago) {
      return {
        ok: false,
        message: `El monto excede el pago original (${formatMoneda(montoPago, true)})`,
      };
    }

    const yaSolicitado = await tx.queryOne<{ id: string }>(
      `SELECT id FROM reembolsos
        WHERE pago_id = $1 AND estatus IN ('solicitado', 'aprobado', 'procesado')`,
      [pagoId],
    );
    if (yaSolicitado) {
      return { ok: false, message: 'Ya hay un reembolso en curso para este pago' };
    }

    const reembolso = await tx.queryOne<{ id: string }>(
      `INSERT INTO reembolsos (pago_id, ticket_id, monto, motivo)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [pagoId, ticketId, monto, motivo],
    );
    if (!reembolso) return { ok: false, message: 'No pudimos crear la solicitud' };

    const umbral = await getUmbralExpressMxn(tx);
    const puedeExpress = tienePermiso(viewer, 'soporte.reembolso.aprobar_express');
    const dentroUmbral = monto <= umbral;
    const autoAprobado = puedeExpress && dentroUmbral;

    if (autoAprobado) {
      await tx.query(
        `UPDATE reembolsos SET estatus = 'aprobado', aprobado_por = $1 WHERE id = $2`,
        [viewer.userId, reembolso.id],
      );
      await tx.query(
        `INSERT INTO tareas_caso
           (ticket_id, tipo, asunto, descripcion_md, payload,
            grupo_asignado, creado_por, bloqueante)
         VALUES ($1, 'reembolso'::tipo_tarea_caso, $2, $3, $4::jsonb,
                 'finanzas_l2', $5, true)`,
        [
          ticketId,
          `Procesar reembolso ${formatMoneda(monto, true)}`,
          `Reembolso aprobado express por ${viewer.nombre} ${viewer.apellidos}. Motivo: ${motivo}`,
          JSON.stringify({ reembolso_id: reembolso.id, pago_id: pagoId, monto }),
          viewer.userId,
        ],
      );
      await tx.query(
        `UPDATE tickets_soporte
            SET action_status = 'esperando_finanzas'::action_status_ticket,
                action_status_motivo = $1,
                action_status_desde = NOW(),
                updated_at = NOW()
          WHERE id = $2`,
        [`Reembolso ${formatMoneda(monto, true)} aprobado, finanzas debe procesarlo`, ticketId],
      );

      await logAccion(tx, {
        adminId: viewer.userId,
        accion: 'soporte.reembolso.solicitado_express',
        entidad: 'reembolsos',
        entidadId: reembolso.id,
        valorNuevo: { monto, ticket_id: ticketId, auto_aprobado: true, umbral },
        ticketId,
      });
    } else {
      const aprob = await tx.queryOne<{ id: string }>(
        `INSERT INTO aprobaciones
           (entidad, entidad_id, motivo_md, monto_mxn,
            solicitado_por, aprobador_grupo)
         VALUES ('reembolsos', $1, $2, $3, $4, 'finanzas')
         RETURNING id`,
        [
          reembolso.id,
          `Reembolso ${formatMoneda(monto, true)} sobre pago ${pagoId.slice(0, 8)}. Motivo: ${motivo}`,
          monto,
          viewer.userId,
        ],
      );
      await tx.query(
        `UPDATE tickets_soporte
            SET action_status = 'esperando_aprobacion'::action_status_ticket,
                action_status_motivo = $1,
                action_status_desde = NOW(),
                updated_at = NOW()
          WHERE id = $2`,
        [`Reembolso ${formatMoneda(monto, true)} esperando aprobación finanzas`, ticketId],
      );

      await logAccion(tx, {
        adminId: viewer.userId,
        accion: 'soporte.reembolso.solicitado',
        entidad: 'reembolsos',
        entidadId: reembolso.id,
        valorNuevo: {
          monto,
          ticket_id: ticketId,
          auto_aprobado: false,
          aprobacion_id: aprob?.id,
          umbral,
        },
        ticketId,
      });

      revalidatePath(`/dashboard/soporte/ticket/${ticketId}`);
      revalidatePath('/dashboard/finanzas/aprobaciones-pendientes');
      return {
        ok: true,
        reembolsoId: reembolso.id,
        aprobacionId: aprob?.id,
        autoAprobado: false,
      };
    }

    revalidatePath(`/dashboard/soporte/ticket/${ticketId}`);
    revalidatePath('/dashboard/finanzas/tareas-bandeja');
    revalidatePath('/dashboard/reembolsos');
    return { ok: true, reembolsoId: reembolso.id, autoAprobado: true };
  });
}
