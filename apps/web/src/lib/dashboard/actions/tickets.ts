'use server';

import { revalidatePath } from 'next/cache';
import { query, withTransaction } from '@expressmx/database';
import { logAccion, logAccionDirecta } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { incrementarUsoCanned } from '@/lib/dashboard/queries/canned';
import { publishTicketRealtimeEvent } from '@/lib/realtime/ably';
import type {
  EstatusTicket,
  PrioridadTicket,
} from '@/lib/dashboard/tickets-shared';

interface ActionResult {
  ok: boolean;
  message?: string;
}

interface MensajeTicketRealtime {
  id: string;
  ticket_id: string;
  autor_id: string | null;
  autor_nombre: string | null;
  tipo_autor: 'usuario' | 'agente' | 'sistema';
  contenido: string;
  es_interno: boolean;
  created_at: string;
}

export async function asignarTicket(
  ticketId: string,
  agenteId: string | null,
): Promise<ActionResult> {
  const viewer = await requirePermiso('tickets.gestionar');
  const updated = await query<{ id: string }>(
    `UPDATE tickets_soporte SET agente_id = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
    [agenteId, ticketId],
  );
  if (updated.length === 0) return { ok: false, message: 'No encontramos el ticket' };

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'ticket.asignado',
    entidad: 'tickets_soporte',
    entidadId: ticketId,
    valorNuevo: { agente_id: agenteId },
  });

  revalidatePath('/dashboard/tickets');
  revalidatePath(`/dashboard/tickets/${ticketId}`);
  await publishTicketRealtimeEvent({
    ticketId,
    name: 'ticket.updated',
    data: { ticketId },
  });
  return { ok: true };
}

export async function asignarmeTicket(ticketId: string): Promise<ActionResult> {
  const viewer = await requirePermiso('tickets.gestionar');
  return asignarTicket(ticketId, viewer.userId);
}

export async function cambiarEstatusTicket(
  ticketId: string,
  estatus: EstatusTicket,
): Promise<ActionResult> {
  const viewer = await requirePermiso('tickets.gestionar');
  const updated = await query<{ id: string }>(
    `UPDATE tickets_soporte SET estatus = $1::estatus_ticket, updated_at = NOW() WHERE id = $2 RETURNING id`,
    [estatus, ticketId],
  );
  if (updated.length === 0) return { ok: false, message: 'No encontramos el ticket' };

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'ticket.estatus_cambiado',
    entidad: 'tickets_soporte',
    entidadId: ticketId,
    valorNuevo: { estatus },
  });

  revalidatePath('/dashboard/tickets');
  revalidatePath(`/dashboard/tickets/${ticketId}`);
  await publishTicketRealtimeEvent({
    ticketId,
    name: 'ticket.updated',
    data: { ticketId, status: estatus },
  });
  return { ok: true };
}

export async function cambiarPrioridadTicket(
  ticketId: string,
  prioridad: PrioridadTicket,
): Promise<ActionResult> {
  const viewer = await requirePermiso('tickets.gestionar');
  const updated = await query<{ id: string }>(
    `UPDATE tickets_soporte SET prioridad = $1::prioridad_ticket, updated_at = NOW() WHERE id = $2 RETURNING id`,
    [prioridad, ticketId],
  );
  if (updated.length === 0) return { ok: false, message: 'No encontramos el ticket' };

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'ticket.prioridad_cambiada',
    entidad: 'tickets_soporte',
    entidadId: ticketId,
    valorNuevo: { prioridad },
  });

  revalidatePath(`/dashboard/tickets/${ticketId}`);
  await publishTicketRealtimeEvent({
    ticketId,
    name: 'ticket.updated',
    data: { ticketId },
  });
  return { ok: true };
}

export interface ResponderTicketOpts {
  resolver?: boolean;
  esInterno?: boolean;
  cannedResponseId?: string | null;
}

export async function responderTicket(
  ticketId: string,
  contenido: string,
  opts: boolean | ResponderTicketOpts = {},
): Promise<ActionResult> {
  const viewer = await requirePermiso('tickets.gestionar');
  const texto = contenido.trim();
  if (texto.length < 1) return { ok: false, message: 'La respuesta no puede estar vacía' };
  if (texto.length > 4000) return { ok: false, message: 'La respuesta es muy larga (máx. 4000)' };

  const normalized: ResponderTicketOpts =
    typeof opts === 'boolean' ? { resolver: opts } : opts;
  const resolver = normalized.resolver === true;
  const esInterno = normalized.esInterno === true;
  const cannedResponseId =
    typeof normalized.cannedResponseId === 'string' && normalized.cannedResponseId.length > 0
      ? normalized.cannedResponseId
      : null;

  if (esInterno && resolver) {
    return {
      ok: false,
      message: 'Una nota interna no puede marcar el ticket como resuelto',
    };
  }

  const result = await withTransaction(async (tx): Promise<ActionResult & { mensaje?: MensajeTicketRealtime }> => {
    const ticket = await tx.queryOne<{ id: string; estatus: string }>(
      `SELECT id, estatus FROM tickets_soporte WHERE id = $1 FOR UPDATE`,
      [ticketId],
    );
    if (!ticket) return { ok: false, message: 'No encontramos el ticket' };
    if (ticket.estatus === 'resuelto') {
      return { ok: false, message: 'Este ticket ya está resuelto. Reábrelo para responder.' };
    }

    const mensaje = await tx.queryOne<MensajeTicketRealtime>(
      `INSERT INTO mensajes_ticket
         (ticket_id, autor_id, tipo_autor, contenido, es_interno, canned_response_id)
       VALUES ($1, $2, 'agente', $3, $4, $5)
       RETURNING
         id,
         ticket_id,
         autor_id,
         (SELECT nombre || ' ' || apellidos FROM usuarios WHERE id = $2) AS autor_nombre,
         tipo_autor::text AS tipo_autor,
         contenido,
         es_interno,
         created_at`,
      [ticketId, viewer.userId, texto, esInterno, cannedResponseId],
    );
    if (!mensaje) return { ok: false, message: 'No pudimos guardar el mensaje' };

    if (!esInterno && ticket.estatus === 'abierto') {
      await tx.query(
        `UPDATE tickets_soporte SET estatus = 'en_revision', agente_id = COALESCE(agente_id, $2), updated_at = NOW() WHERE id = $1`,
        [ticketId, viewer.userId],
      );
    } else {
      await tx.query(
        `UPDATE tickets_soporte SET updated_at = NOW() WHERE id = $1`,
        [ticketId],
      );
    }

    if (resolver) {
      await tx.query(
        `UPDATE tickets_soporte SET estatus = 'resuelto', updated_at = NOW() WHERE id = $1`,
        [ticketId],
      );
      await logAccion(tx, {
        adminId: viewer.userId,
        accion: 'ticket.resuelto',
        entidad: 'tickets_soporte',
        entidadId: ticketId,
        ticketId,
        valorAnterior: { estatus: ticket.estatus },
        valorNuevo: { estatus: 'resuelto' },
      });
    }

    if (esInterno) {
      await logAccion(tx, {
        adminId: viewer.userId,
        accion: 'ticket.nota_interna',
        entidad: 'tickets_soporte',
        entidadId: ticketId,
        ticketId,
      });
    }

    revalidatePath('/dashboard/tickets');
    revalidatePath(`/dashboard/tickets/${ticketId}`);
    revalidatePath(`/dashboard/soporte/ticket/${ticketId}`);
    return { ok: true, mensaje };
  });

  if (result.ok && cannedResponseId) {
    try {
      await incrementarUsoCanned(cannedResponseId);
    } catch {}
  }

  if (result.ok && result.mensaje) {
    await publishTicketRealtimeEvent({
      ticketId,
      name: 'ticket.message_created',
      data: {
        ticketId,
        messageId: result.mensaje.id,
        content: result.mensaje.contenido,
        authorId: result.mensaje.autor_id,
        authorName: result.mensaje.autor_nombre,
        authorType: result.mensaje.tipo_autor,
        internal: result.mensaje.es_interno,
        createdAt: result.mensaje.created_at,
      },
    });
  }

  return result;
}
