'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@expressmx/validations';
import { withTransaction } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';

interface ActionResult {
  ok: boolean;
  message?: string;
  recordatorioId?: string;
}

const TIPO_RECORDATORIO = [
  'callback_cliente',
  'follow_up_interno',
  'reabrir_ticket',
  'ejecutar_tarea',
] as const;

const MIN_LEAD_MINUTOS = 5;

const CrearInput = z.object({
  ticketId: z.string().uuid(),
  tipo: z.enum(TIPO_RECORDATORIO),
  dispararAt: z.string().datetime({ offset: true }),
  paraUser: z.string().uuid().optional(),
  asunto: z.string().trim().min(3, 'Asunto mínimo 3 caracteres').max(160),
  notasMd: z.string().trim().min(0).max(2000).optional(),
  payload: z.record(z.unknown()).optional(),
});

export async function crearRecordatorio(
  input: z.infer<typeof CrearInput>,
): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.recordatorio.crear');
  const parsed = CrearInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { ticketId, tipo, dispararAt, paraUser, asunto, notasMd, payload } = parsed.data;

  const dispararDate = new Date(dispararAt);
  if (Number.isNaN(dispararDate.getTime())) {
    return { ok: false, message: 'Fecha inválida' };
  }
  const leadMs = dispararDate.getTime() - Date.now();
  if (leadMs < MIN_LEAD_MINUTOS * 60_000) {
    return {
      ok: false,
      message: `El recordatorio debe programarse al menos ${MIN_LEAD_MINUTOS} minutos en el futuro`,
    };
  }

  return await withTransaction(async (tx) => {
    const ticket = await tx.queryOne<{ id: string; estatus: string }>(
      `SELECT id, estatus::text AS estatus FROM tickets_soporte WHERE id = $1`,
      [ticketId],
    );
    if (!ticket) return { ok: false, message: 'Ticket no encontrado' };

    const destinatario = paraUser ?? viewer.userId;

    if (destinatario !== viewer.userId) {
      const destino = await tx.queryOne<{ id: string; rol: string }>(
        `SELECT id, rol::text AS rol FROM usuarios WHERE id = $1`,
        [destinatario],
      );
      if (!destino) return { ok: false, message: 'Usuario destino no existe' };
      if (destino.rol === 'cliente' || destino.rol === 'prestador') {
        return { ok: false, message: 'Solo personal interno puede recibir recordatorios' };
      }
    }

    const row = await tx.queryOne<{ id: string }>(
      `INSERT INTO recordatorios_soporte
         (ticket_id, tipo, disparar_at, para_user, asunto, notas_md, payload, creado_por)
       VALUES ($1, $2::tipo_recordatorio, $3, $4, $5, $6, $7::jsonb, $8)
       RETURNING id`,
      [
        ticketId,
        tipo,
        dispararDate.toISOString(),
        destinatario,
        asunto,
        notasMd && notasMd.length > 0 ? notasMd : null,
        JSON.stringify(payload ?? {}),
        viewer.userId,
      ],
    );
    if (!row) return { ok: false, message: 'No pudimos crear el recordatorio' };

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.recordatorio.creado',
      entidad: 'recordatorios_soporte',
      entidadId: row.id,
      valorNuevo: {
        tipo,
        disparar_at: dispararDate.toISOString(),
        para_user: destinatario,
        asunto,
      },
      ticketId,
    });

    revalidatePath(`/dashboard/soporte/ticket/${ticketId}`);
    return { ok: true, recordatorioId: row.id };
  });
}

const CancelarInput = z.object({
  recordatorioId: z.string().uuid(),
  motivo: z.string().trim().max(500).optional(),
});

export async function cancelarRecordatorio(
  input: z.infer<typeof CancelarInput>,
): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.recordatorio.crear');
  const parsed = CancelarInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { recordatorioId, motivo } = parsed.data;

  return await withTransaction(async (tx) => {
    const r = await tx.queryOne<{
      id: string;
      ticket_id: string;
      creado_por: string;
      para_user: string;
      disparado_at: string | null;
      cancelado_at: string | null;
    }>(
      `SELECT id, ticket_id, creado_por, para_user, disparado_at, cancelado_at
         FROM recordatorios_soporte
        WHERE id = $1
        FOR UPDATE`,
      [recordatorioId],
    );
    if (!r) return { ok: false, message: 'Recordatorio no encontrado' };
    if (r.disparado_at) return { ok: false, message: 'El recordatorio ya se disparó' };
    if (r.cancelado_at) return { ok: false, message: 'El recordatorio ya fue cancelado' };

    const isCreator = r.creado_por === viewer.userId;
    const isOwner = r.para_user === viewer.userId;
    const isSuperAdmin = tienePermiso(viewer, 'roles.gestionar');
    if (!isCreator && !isOwner && !isSuperAdmin) {
      return { ok: false, message: 'Solo el creador o el destinatario pueden cancelar' };
    }

    await tx.query(
      `UPDATE recordatorios_soporte
          SET cancelado_at = NOW()
        WHERE id = $1`,
      [recordatorioId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.recordatorio.cancelado',
      entidad: 'recordatorios_soporte',
      entidadId: recordatorioId,
      valorNuevo: { motivo: motivo ?? null },
      ticketId: r.ticket_id,
    });

    revalidatePath(`/dashboard/soporte/ticket/${r.ticket_id}`);
    return { ok: true };
  });
}
