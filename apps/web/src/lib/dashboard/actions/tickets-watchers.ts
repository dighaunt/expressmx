'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@expressmx/validations';
import { withTransaction } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requireViewer } from '@/lib/dashboard/auth-gate';
import { tieneAlgunPermiso, type Viewer } from '@/lib/dashboard/rbac';

interface ActionResult {
  ok: boolean;
  message?: string;
}

const Input = z.object({
  ticketId: z.string().uuid(),
  userId: z.string().uuid(),
});

const EmailInput = z.object({
  ticketId: z.string().uuid(),
  email: z.string().trim().email().max(320),
});

const WATCHER_PERMISOS = [
  'tickets.gestionar',
  'soporte.tarea.crear',
  'soporte.mim.declarar',
] as const;

function puedeGestionarWatchers(viewer: Viewer): boolean {
  return tieneAlgunPermiso(viewer, WATCHER_PERMISOS);
}

export async function agregarWatcher(
  input: z.infer<typeof Input>,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!puedeGestionarWatchers(viewer)) {
    return { ok: false, message: 'Sin permiso para gestionar participantes' };
  }
  const parsed = Input.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { ticketId, userId } = parsed.data;

  return await withTransaction(async (tx) => {
    const ticket = await tx.queryOne<{ id: string }>(
      `SELECT id FROM tickets_soporte WHERE id = $1`,
      [ticketId],
    );
    if (!ticket) return { ok: false, message: 'Ticket no encontrado' };

    const watcher = await tx.queryOne<{ id: string; rol: string }>(
      `SELECT id, rol::text AS rol FROM usuarios WHERE id = $1`,
      [userId],
    );
    if (!watcher) return { ok: false, message: 'Usuario no encontrado' };
    if (watcher.rol === 'cliente' || watcher.rol === 'prestador') {
      return { ok: false, message: 'Solo personal interno puede ser watcher' };
    }

    const inserted = await tx.queryOne<{ ticket_id: string }>(
      `INSERT INTO tickets_watchers (ticket_id, user_id, agregado_por)
       VALUES ($1, $2, $3)
       ON CONFLICT (ticket_id, user_id) DO NOTHING
       RETURNING ticket_id`,
      [ticketId, userId, viewer.userId],
    );

    if (inserted) {
      await logAccion(tx, {
        adminId: viewer.userId,
        accion: 'soporte.watcher.agregado',
        entidad: 'tickets_watchers',
        entidadId: ticketId,
        valorNuevo: { user_id: userId },
        ticketId,
      });
    }

    revalidatePath(`/dashboard/soporte/ticket/${ticketId}`);
    return { ok: true };
  });
}

export async function agregarWatcherPorEmail(
  input: z.infer<typeof EmailInput>,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!puedeGestionarWatchers(viewer)) {
    return { ok: false, message: 'Sin permiso para gestionar participantes' };
  }
  const parsed = EmailInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { ticketId, email } = parsed.data;
  const emailLower = email.toLowerCase();

  return await withTransaction(async (tx) => {
    const ticket = await tx.queryOne<{ id: string }>(
      `SELECT id FROM tickets_soporte WHERE id = $1`,
      [ticketId],
    );
    if (!ticket) return { ok: false, message: 'Ticket no encontrado' };

    const watcher = await tx.queryOne<{ id: string; rol: string }>(
      `SELECT id, rol::text AS rol
         FROM usuarios
        WHERE LOWER(email) = $1`,
      [emailLower],
    );
    if (!watcher) return { ok: false, message: 'Usuario no encontrado' };
    if (watcher.rol === 'cliente' || watcher.rol === 'prestador') {
      return { ok: false, message: 'Solo personal interno puede ser participante' };
    }

    const inserted = await tx.queryOne<{ ticket_id: string }>(
      `INSERT INTO tickets_watchers (ticket_id, user_id, agregado_por)
       VALUES ($1, $2, $3)
       ON CONFLICT (ticket_id, user_id) DO NOTHING
       RETURNING ticket_id`,
      [ticketId, watcher.id, viewer.userId],
    );

    if (inserted) {
      await logAccion(tx, {
        adminId: viewer.userId,
        accion: 'soporte.watcher.agregado',
        entidad: 'tickets_watchers',
        entidadId: ticketId,
        valorNuevo: { user_id: watcher.id, email: emailLower },
        ticketId,
      });
    }

    revalidatePath(`/dashboard/soporte/ticket/${ticketId}`);
    if (!inserted) {
      return { ok: true, message: 'Ese usuario ya participa en el ticket' };
    }
    return { ok: true };
  });
}

export async function quitarWatcher(
  input: z.infer<typeof Input>,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!puedeGestionarWatchers(viewer)) {
    return { ok: false, message: 'Sin permiso para gestionar participantes' };
  }
  const parsed = Input.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { ticketId, userId } = parsed.data;

  return await withTransaction(async (tx) => {
    const removed = await tx.queryOne<{ user_id: string }>(
      `DELETE FROM tickets_watchers
        WHERE ticket_id = $1 AND user_id = $2
        RETURNING user_id`,
      [ticketId, userId],
    );

    if (removed) {
      await logAccion(tx, {
        adminId: viewer.userId,
        accion: 'soporte.watcher.quitado',
        entidad: 'tickets_watchers',
        entidadId: ticketId,
        valorAnterior: { user_id: userId },
        ticketId,
      });
    }

    revalidatePath(`/dashboard/soporte/ticket/${ticketId}`);
    return { ok: true };
  });
}
