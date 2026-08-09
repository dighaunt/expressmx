'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@expressmx/validations';
import { withTransaction } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

interface ActionResult {
  ok: boolean;
  message?: string;
  tareaId?: string;
}

const Input = z.object({
  ticketId: z.string().uuid(),
  ordenId: z.string().uuid(),
  motivo: z.string().trim().min(10, 'Motivo mínimo 10 caracteres').max(2000),
  preferirZona: z.string().trim().max(100).optional(),
  bloqueante: z.boolean().optional(),
});

export async function solicitarReasignacionPrestador(
  input: z.infer<typeof Input>,
): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.tarea.crear');
  const parsed = Input.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { ticketId, ordenId, motivo, preferirZona, bloqueante } = parsed.data;

  return await withTransaction(async (tx) => {
    const orden = await tx.queryOne<{
      id: string;
      cliente_id: string;
      prestador_id: string | null;
      estatus: string;
    }>(
      `SELECT id, cliente_id, prestador_id, estatus::text AS estatus
         FROM ordenes_servicio WHERE id = $1`,
      [ordenId],
    );
    if (!orden) return { ok: false, message: 'Orden no encontrada' };
    if (!['solicitada', 'asignada', 'en_camino'].includes(orden.estatus)) {
      return {
        ok: false,
        message: `No se puede reasignar prestador en estatus "${orden.estatus}"`,
      };
    }

    const ticket = await tx.queryOne<{ usuario_id: string }>(
      `SELECT usuario_id FROM tickets_soporte WHERE id = $1`,
      [ticketId],
    );
    if (!ticket) return { ok: false, message: 'Ticket no encontrado' };
    if (ticket.usuario_id !== orden.cliente_id) {
      return { ok: false, message: 'La orden no pertenece al cliente del ticket' };
    }

    const tarea = await tx.queryOne<{ id: string }>(
      `INSERT INTO tareas_caso
         (ticket_id, tipo, asunto, descripcion_md, payload,
          grupo_asignado, creado_por, bloqueante)
       VALUES ($1, 'reasignar_prestador'::tipo_tarea_caso, $2, $3, $4::jsonb,
               'operaciones_l1', $5, $6)
       RETURNING id`,
      [
        ticketId,
        `Reasignar prestador para orden ${ordenId.slice(0, 8)}`,
        motivo,
        JSON.stringify({
          orden_id: ordenId,
          prestador_actual: orden.prestador_id,
          preferir_zona: preferirZona ?? null,
        }),
        viewer.userId,
        bloqueante ?? true,
      ],
    );
    if (!tarea) return { ok: false, message: 'No pudimos crear la tarea' };

    await tx.query(
      `UPDATE tickets_soporte
          SET action_status = 'esperando_operaciones'::action_status_ticket,
              action_status_motivo = $1,
              action_status_desde = NOW(),
              updated_at = NOW()
        WHERE id = $2`,
      [`Reasignación de prestador en curso (orden ${ordenId.slice(0, 8)})`, ticketId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.reasignar_prestador.solicitado',
      entidad: 'tareas_caso',
      entidadId: tarea.id,
      valorNuevo: {
        orden_id: ordenId,
        prestador_actual: orden.prestador_id,
        motivo,
      },
      ticketId,
    });

    revalidatePath(`/dashboard/soporte/ticket/${ticketId}`);
    revalidatePath('/dashboard/operaciones/tareas-bandeja');
    return { ok: true, tareaId: tarea.id };
  });
}
