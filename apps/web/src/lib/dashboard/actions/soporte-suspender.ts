'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@expressmx/validations';
import { withTransaction, type Tx } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

interface ActionResult {
  ok: boolean;
  message?: string;
  suspensionId?: string | undefined;
  tareaId?: string | undefined;
  requiereAprobacion?: boolean;
}

const MOTIVOS = [
  'fraude_sospechoso',
  'incumplimiento_pago',
  'abuso_servicio',
  'queja_prestador',
  'verificacion_pendiente',
  'a_solicitud_cliente',
] as const;

const SuspenderInput = z.object({
  ticketId: z.string().uuid().optional().nullable(),
  usuarioId: z.string().uuid(),
  motivo: z.enum(MOTIVOS),
  notas: z.string().trim().min(10, 'Notas mínimo 10 caracteres').max(2000),
  diasVentana: z.number().int().min(1).max(365).optional().nullable(),
});

async function getMaxDiasExpress(tx: Tx): Promise<number> {
  const row = await tx.queryOne<{ valor: string }>(
    `SELECT valor FROM config_sistema WHERE clave = 'suspension_express_max_dias'`,
  );
  const parsed = row ? Number(row.valor) : 7;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
}

export async function suspenderCuenta(
  input: z.infer<typeof SuspenderInput>,
): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.suspender_cuenta');
  const parsed = SuspenderInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { ticketId, usuarioId, motivo, notas, diasVentana } = parsed.data;

  return await withTransaction(async (tx) => {
    const u = await tx.queryOne<{ id: string; rol: string; activo: boolean }>(
      `SELECT id, rol::text AS rol, activo FROM usuarios WHERE id = $1 FOR UPDATE`,
      [usuarioId],
    );
    if (!u) return { ok: false, message: 'Usuario no encontrado' };
    if (!u.activo) {
      return { ok: false, message: 'La cuenta ya está suspendida o inactiva' };
    }

    const yaSuspension = await tx.queryOne<{ id: string }>(
      `SELECT id FROM suspensiones_cuenta
        WHERE usuario_id = $1 AND reactivada_at IS NULL
        LIMIT 1`,
      [usuarioId],
    );
    if (yaSuspension) {
      return { ok: false, message: 'El usuario ya tiene una suspensión activa' };
    }

    const yaPendiente = await tx.queryOne<{ id: string }>(
      `SELECT id FROM tareas_caso
        WHERE tipo = 'follow_up_interno'::tipo_tarea_caso
          AND grupo_asignado = 'super_admin'
          AND payload->>'subtipo' = 'suspension_pendiente'
          AND payload->>'usuario_id' = $1
          AND estado IN ('abierta','en_progreso','esperando_aprobacion')
        LIMIT 1`,
      [usuarioId],
    );
    if (yaPendiente) {
      return { ok: false, message: 'Ya existe una solicitud de suspensión en curso para este usuario' };
    }

    const maxExpress = await getMaxDiasExpress(tx);
    const requiereAprobacion = !diasVentana || diasVentana > maxExpress;

    const ventanaFinIso = diasVentana
      ? new Date(Date.now() + diasVentana * 24 * 60 * 60 * 1000).toISOString()
      : null;

    if (!requiereAprobacion) {
      const susp = await tx.queryOne<{ id: string }>(
        `INSERT INTO suspensiones_cuenta
           (usuario_id, motivo, notas_md, ticket_id,
            ventana_inicio, ventana_fin, creada_por)
         VALUES ($1, $2::motivo_suspension, $3, $4, NOW(), $5, $6)
         RETURNING id`,
        [usuarioId, motivo, notas, ticketId ?? null, ventanaFinIso, viewer.userId],
      );
      if (!susp) return { ok: false, message: 'No pudimos crear la suspensión' };

      if (ticketId) {
        await tx.query(
          `UPDATE tickets_soporte
              SET action_status = 'ninguno'::action_status_ticket,
                  action_status_motivo = NULL,
                  action_status_desde = NULL,
                  updated_at = NOW()
            WHERE id = $1`,
          [ticketId],
        );
      }

      await logAccion(tx, {
        adminId: viewer.userId,
        accion: 'soporte.suspension.creada',
        entidad: 'suspensiones_cuenta',
        entidadId: susp.id,
        valorNuevo: {
          usuario_id: usuarioId,
          motivo,
          ventana_dias: diasVentana ?? null,
          via: 'express',
        },
        ticketId: ticketId ?? null,
      });

      if (ticketId) revalidatePath(`/dashboard/soporte/ticket/${ticketId}`);
      return { ok: true, suspensionId: susp.id, requiereAprobacion: false };
    }

    if (!ticketId) {
      return {
        ok: false,
        message: 'Suspensiones escaladas requieren un ticket vinculado',
      };
    }

    const tarea = await tx.queryOne<{ id: string }>(
      `INSERT INTO tareas_caso
         (ticket_id, tipo, asunto, descripcion_md, payload,
          grupo_asignado, creado_por, bloqueante)
       VALUES ($1, 'follow_up_interno'::tipo_tarea_caso, $2, $3, $4::jsonb,
               'super_admin', $5, true)
       RETURNING id`,
      [
        ticketId,
        `Suspensión ${diasVentana ? diasVentana + ' días' : 'indefinida'} de ${usuarioId.slice(0, 8)}`,
        notas,
        JSON.stringify({
          subtipo: 'suspension_pendiente',
          usuario_id: usuarioId,
          motivo,
          dias_ventana: diasVentana ?? null,
          ventana_fin: ventanaFinIso,
          solicitante_id: viewer.userId,
        }),
        viewer.userId,
      ],
    );
    if (!tarea) return { ok: false, message: 'No pudimos crear la solicitud' };

    await tx.query(
      `UPDATE tickets_soporte
          SET action_status = 'esperando_aprobacion'::action_status_ticket,
              action_status_motivo = $1,
              action_status_desde = NOW(),
              updated_at = NOW()
        WHERE id = $2`,
      [`suspension:${tarea.id}`, ticketId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.suspension.solicitada',
      entidad: 'tareas_caso',
      entidadId: tarea.id,
      valorNuevo: {
        usuario_id: usuarioId,
        motivo,
        dias_ventana: diasVentana ?? null,
        via: 'tarea_super_admin',
      },
      ticketId,
    });

    revalidatePath(`/dashboard/soporte/ticket/${ticketId}`);
    revalidatePath('/dashboard/finanzas/tareas-bandeja');
    return { ok: true, tareaId: tarea.id, requiereAprobacion: true };
  });
}

const ReactivarInput = z.object({
  suspensionId: z.string().uuid(),
  motivo: z.string().trim().min(5).max(2000),
});

export async function reactivarCuenta(
  input: z.infer<typeof ReactivarInput>,
): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.reactivar_cuenta');
  const parsed = ReactivarInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { suspensionId, motivo } = parsed.data;

  return await withTransaction(async (tx) => {
    const s = await tx.queryOne<{
      usuario_id: string;
      reactivada_at: string | null;
      ticket_id: string | null;
    }>(
      `SELECT usuario_id, reactivada_at, ticket_id
         FROM suspensiones_cuenta
        WHERE id = $1
        FOR UPDATE`,
      [suspensionId],
    );
    if (!s) return { ok: false, message: 'Suspensión no encontrada' };
    if (s.reactivada_at) return { ok: false, message: 'Ya estaba reactivada' };

    await tx.query(
      `UPDATE suspensiones_cuenta
          SET reactivada_at = NOW(),
              reactivada_por = $1,
              reactivacion_motivo_md = $2
        WHERE id = $3`,
      [viewer.userId, motivo, suspensionId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.suspension.reactivada',
      entidad: 'suspensiones_cuenta',
      entidadId: suspensionId,
      valorNuevo: { usuario_id: s.usuario_id, motivo },
      ticketId: s.ticket_id,
    });

    if (s.ticket_id) revalidatePath(`/dashboard/soporte/ticket/${s.ticket_id}`);
    return { ok: true, suspensionId };
  });
}
