import 'server-only';
import { query, queryOne } from '@expressmx/database';
import {
  CATEGORIA_LABEL,
  ESTATUS_LABEL,
  PRIORIDAD_LABEL,
  type CategoriaTicket,
  type EstatusTicket,
  type PrioridadTicket,
  type TipoAutorMsg,
} from '@/lib/dashboard/tickets-shared';

export {
  CATEGORIA_LABEL,
  ESTATUS_LABEL,
  PRIORIDAD_LABEL,
};
export type { CategoriaTicket, EstatusTicket, PrioridadTicket, TipoAutorMsg };

export interface TicketListItem {
  id: string;
  asunto: string;
  categoria: CategoriaTicket;
  prioridad: PrioridadTicket;
  estatus: EstatusTicket;
  usuario_id: string;
  usuario_nombre: string;
  agente_id: string | null;
  agente_nombre: string | null;
  orden_id: string | null;
  mensajes_count: number;
  created_at: string;
  updated_at: string;
}

export interface TicketDetail extends TicketListItem {
  rol_usuario: string;
}

export interface MensajeRow {
  id: string;
  ticket_id: string;
  autor_id: string;
  autor_nombre: string;
  tipo_autor: TipoAutorMsg;
  contenido: string;
  adjunto_url: string | null;
  created_at: string;
}

export interface TicketsFilter {
  estatus?: EstatusTicket | 'todos';
  prioridad?: PrioridadTicket | 'todas';
  q?: string;
  asignacion?: 'todos' | 'sin_asignar' | 'mios';
  agente_id?: string;
  limit?: number;
  offset?: number;
}

export async function listarTickets(filter: TicketsFilter = {}): Promise<{
  total: number;
  rows: TicketListItem[];
}> {
  const where: string[] = [];
  const args: unknown[] = [];

  if (filter.estatus && filter.estatus !== 'todos') {
    args.push(filter.estatus);
    where.push(`t.estatus = $${args.length}::estatus_ticket`);
  }
  if (filter.prioridad && filter.prioridad !== 'todas') {
    args.push(filter.prioridad);
    where.push(`t.prioridad = $${args.length}::prioridad_ticket`);
  }
  if (filter.asignacion === 'sin_asignar') {
    where.push(`t.agente_id IS NULL`);
  } else if (filter.asignacion === 'mios' && filter.agente_id) {
    args.push(filter.agente_id);
    where.push(`t.agente_id = $${args.length}`);
  }
  if (filter.q && filter.q.trim()) {
    args.push(`%${filter.q.trim().toLowerCase()}%`);
    where.push(
      `(LOWER(t.asunto) LIKE $${args.length} OR LOWER(u.nombre || ' ' || u.apellidos) LIKE $${args.length})`,
    );
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);

  const totalRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*) AS total
     FROM tickets_soporte t
     JOIN usuarios u ON u.id = t.usuario_id
     ${whereSql}`,
    args,
  );

  args.push(limit, offset);
  const rows = await query<TicketListItem>(
    `SELECT
       t.id, t.asunto, t.categoria, t.prioridad, t.estatus,
       t.usuario_id, t.agente_id, t.orden_id, t.created_at, t.updated_at,
       (u.nombre || ' ' || u.apellidos) AS usuario_nombre,
       (CASE WHEN a.id IS NULL THEN NULL
             ELSE a.nombre || ' ' || COALESCE(LEFT(a.apellidos, 1) || '.', '') END) AS agente_nombre,
       (SELECT COUNT(*) FROM mensajes_ticket m WHERE m.ticket_id = t.id)::INT AS mensajes_count
     FROM tickets_soporte t
     JOIN usuarios u ON u.id = t.usuario_id
     LEFT JOIN usuarios a ON a.id = t.agente_id
     ${whereSql}
     ORDER BY
       CASE t.estatus WHEN 'abierto' THEN 0 WHEN 'escalado' THEN 1 WHEN 'en_revision' THEN 2 ELSE 3 END,
       CASE t.prioridad WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
       t.created_at DESC
     LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );

  return { total: Number(totalRow?.total ?? 0), rows };
}

export async function getTicket(id: string): Promise<TicketDetail | null> {
  return queryOne<TicketDetail>(
    `SELECT
       t.id, t.asunto, t.categoria, t.prioridad, t.estatus,
       t.usuario_id, t.agente_id, t.orden_id, t.created_at, t.updated_at,
       (u.nombre || ' ' || u.apellidos) AS usuario_nombre,
       u.rol::TEXT AS rol_usuario,
       (CASE WHEN a.id IS NULL THEN NULL
             ELSE a.nombre || ' ' || COALESCE(LEFT(a.apellidos, 1) || '.', '') END) AS agente_nombre,
       (SELECT COUNT(*) FROM mensajes_ticket m WHERE m.ticket_id = t.id)::INT AS mensajes_count
     FROM tickets_soporte t
     JOIN usuarios u ON u.id = t.usuario_id
     LEFT JOIN usuarios a ON a.id = t.agente_id
     WHERE t.id = $1`,
    [id],
  );
}

export async function listarMensajesTicket(ticketId: string): Promise<MensajeRow[]> {
  return query<MensajeRow>(
    `SELECT
       m.id, m.ticket_id, m.autor_id, m.tipo_autor, m.contenido, m.adjunto_url, m.created_at,
       (u.nombre || ' ' || COALESCE(LEFT(u.apellidos, 1) || '.', '')) AS autor_nombre
     FROM mensajes_ticket m
     LEFT JOIN usuarios u ON u.id = m.autor_id
     WHERE m.ticket_id = $1
     ORDER BY m.created_at ASC`,
    [ticketId],
  );
}
