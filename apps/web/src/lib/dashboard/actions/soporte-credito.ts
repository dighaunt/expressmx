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
  movimientoId?: string | undefined;
  aprobacionId?: string | undefined;
  autoAprobado?: boolean | undefined;
}

const Input = z.object({
  ticketId: z.string().uuid(),
  clienteId: z.string().uuid(),
  monto: z.number().positive().max(50000),
  tipo: z.enum(['credito_manual', 'credito_compensacion']).default('credito_compensacion'),
  motivo: z.string().trim().min(10, 'Motivo mínimo 10 caracteres').max(2000),
});

async function getUmbralCreditoMxn(tx: Tx): Promise<number> {
  const row = await tx.queryOne<{ valor: string }>(
    `SELECT valor FROM config_sistema WHERE clave = 'credito_express_max_mxn'`,
  );
  const parsed = row ? Number(row.valor) : 300;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
}

async function getFactorMaxServicio(tx: Tx): Promise<number> {
  const row = await tx.queryOne<{ valor: string }>(
    `SELECT valor FROM config_sistema WHERE clave = 'credito_factor_max_servicio'`,
  );
  const parsed = row ? Number(row.valor) : 1.0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1.0;
}

export async function aplicarCredito(
  input: z.infer<typeof Input>,
): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.credito.aplicar');
  const parsed = Input.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { ticketId, clienteId, monto, tipo, motivo } = parsed.data;

  return await withTransaction(async (tx) => {
    const ticket = await tx.queryOne<{
      id: string;
      estatus: string;
      usuario_id: string;
      orden_id: string | null;
    }>(
      `SELECT id, estatus::text AS estatus, usuario_id, orden_id
         FROM tickets_soporte WHERE id = $1`,
      [ticketId],
    );
    if (!ticket) return { ok: false, message: 'Ticket no encontrado' };
    if (ticket.estatus === 'resuelto' || ticket.estatus === 'cerrado') {
      return { ok: false, message: 'No se puede aplicar crédito en un ticket cerrado' };
    }
    if (ticket.usuario_id !== clienteId) {
      return { ok: false, message: 'El cliente no coincide con el del ticket' };
    }

    const cliente = await tx.queryOne<{ id: string; activo: boolean }>(
      `SELECT id, activo FROM usuarios WHERE id = $1`,
      [clienteId],
    );
    if (!cliente) return { ok: false, message: 'Cliente no encontrado' };

    const puedeSinAprob = tienePermiso(viewer, 'soporte.credito.aplicar_sin_aprobacion');

    let capServicio: number | null = null;
    let factorServicio: number | null = null;
    let montoOrden: number | null = null;
    let aplicadoPrevio = 0;

    if (ticket.orden_id) {
      const orden = await tx.queryOne<{ monto_total: string }>(
        `SELECT monto_total::text AS monto_total
           FROM ordenes_servicio WHERE id = $1`,
        [ticket.orden_id],
      );
      if (orden) {
        montoOrden = Number(orden.monto_total);
        factorServicio = await getFactorMaxServicio(tx);
        capServicio = montoOrden * factorServicio;

        const previo = await tx.queryOne<{ total: string | null }>(
          `SELECT COALESCE(SUM(monto_mxn), 0)::text AS total
             FROM saldo_cliente_movimientos
            WHERE ticket_id = $1
              AND tipo IN ('credito_manual','credito_compensacion')`,
          [ticketId],
        );
        aplicadoPrevio = previo ? Number(previo.total) : 0;

        if (!puedeSinAprob && monto + aplicadoPrevio > capServicio) {
          const total = (monto + aplicadoPrevio).toFixed(2);
          return {
            ok: false,
            message: `El crédito acumulado (${formatMoneda(total, true)}) supera el cap del servicio (${formatMoneda(capServicio, true)} = ${formatMoneda(montoOrden, true)} × ${factorServicio})`,
          };
        }
      }
    }

    const umbral = await getUmbralCreditoMxn(tx);
    const dentroUmbral = monto <= umbral;
    const autoAprobado = puedeSinAprob || dentroUmbral;
    const bypassCap =
      puedeSinAprob && capServicio !== null && monto + aplicadoPrevio > capServicio;

    if (autoAprobado) {
      const mov = await tx.queryOne<{ id: string }>(
        `INSERT INTO saldo_cliente_movimientos
           (cliente_id, tipo, monto_mxn, motivo_md, ticket_id, orden_id, creado_por)
         VALUES ($1, $2::tipo_movimiento_saldo, $3, $4, $5, $6, $7)
         RETURNING id`,
        [clienteId, tipo, monto, motivo, ticketId, ticket.orden_id, viewer.userId],
      );
      if (!mov) return { ok: false, message: 'No pudimos aplicar el crédito' };

      await logAccion(tx, {
        adminId: viewer.userId,
        accion: 'soporte.credito.aplicado',
        entidad: 'saldo_cliente_movimientos',
        entidadId: mov.id,
        valorNuevo: {
          cliente_id: clienteId,
          monto,
          tipo,
          auto_aprobado: true,
          umbral,
          orden_id: ticket.orden_id,
          monto_orden: montoOrden,
          factor_servicio: factorServicio,
          cap_servicio: capServicio,
          aplicado_previo: aplicadoPrevio,
          bypass_cap_servicio: bypassCap,
        },
        ticketId,
      });

      revalidatePath(`/dashboard/soporte/ticket/${ticketId}`);
      return { ok: true, movimientoId: mov.id, autoAprobado: true };
    }

    const tarea = await tx.queryOne<{ id: string }>(
      `INSERT INTO tareas_caso
         (ticket_id, tipo, asunto, descripcion_md, payload,
          grupo_asignado, creado_por, bloqueante)
       VALUES ($1, 'credito_aplicacion'::tipo_tarea_caso, $2, $3, $4::jsonb,
               'finanzas_l2', $5, true)
       RETURNING id`,
      [
        ticketId,
        `Aplicar crédito ${formatMoneda(monto, true)}`,
        `Crédito en cuenta solicitado por ${viewer.nombre} ${viewer.apellidos}. Tipo: ${tipo}. Motivo: ${motivo}`,
        JSON.stringify({
          cliente_id: clienteId,
          monto,
          tipo,
          orden_id: ticket.orden_id,
          cap_servicio: capServicio,
        }),
        viewer.userId,
      ],
    );

    const aprob = tarea
      ? await tx.queryOne<{ id: string }>(
          `INSERT INTO aprobaciones
             (entidad, entidad_id, motivo_md, monto_mxn,
              solicitado_por, aprobador_grupo)
           VALUES ('tareas_caso', $1, $2, $3, $4, 'finanzas')
           RETURNING id`,
          [
            tarea.id,
            `Crédito ${formatMoneda(monto, true)} para cliente ${clienteId.slice(0, 8)}. Motivo: ${motivo}`,
            monto,
            viewer.userId,
          ],
        )
      : null;

    if (aprob) {
      await tx.query(
        `UPDATE tareas_caso
            SET estado = 'esperando_aprobacion',
                updated_at = NOW()
          WHERE id = $1`,
        [tarea?.id],
      );
    }

    await tx.query(
      `UPDATE tickets_soporte
          SET action_status = 'esperando_aprobacion'::action_status_ticket,
              action_status_motivo = $1,
              action_status_desde = NOW(),
              updated_at = NOW()
        WHERE id = $2`,
      [`Crédito ${formatMoneda(monto, true)} esperando aprobación`, ticketId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.credito.solicitado',
      entidad: 'tareas_caso',
      entidadId: tarea?.id ?? null,
      valorNuevo: {
        cliente_id: clienteId,
        monto,
        tipo,
        auto_aprobado: false,
        aprobacion_id: aprob?.id,
        umbral,
        orden_id: ticket.orden_id,
        monto_orden: montoOrden,
        factor_servicio: factorServicio,
        cap_servicio: capServicio,
        aplicado_previo: aplicadoPrevio,
      },
      ticketId,
    });

    revalidatePath(`/dashboard/soporte/ticket/${ticketId}`);
    revalidatePath('/dashboard/finanzas/aprobaciones-pendientes');
    return {
      ok: true,
      aprobacionId: aprob?.id,
      autoAprobado: false,
    };
  });
}
