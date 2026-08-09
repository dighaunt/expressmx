import 'server-only';
import { query } from '@expressmx/database';

export interface TicketWatcher {
  user_id: string;
  user_nombre: string;
  user_email: string;
  user_rol: string;
  agregado_por: string;
  agregado_por_nombre: string;
  agregado_at: string;
}

export async function listarWatchers(ticketId: string): Promise<TicketWatcher[]> {
  return await query<TicketWatcher>(
    `SELECT
       w.user_id,
       u.nombre || ' ' || u.apellidos AS user_nombre,
       u.email AS user_email,
       u.rol::text AS user_rol,
       w.agregado_por,
       creator.nombre || ' ' || creator.apellidos AS agregado_por_nombre,
       w.agregado_at
     FROM tickets_watchers w
     JOIN usuarios u ON u.id = w.user_id
     LEFT JOIN usuarios creator ON creator.id = w.agregado_por
     WHERE w.ticket_id = $1
     ORDER BY w.agregado_at ASC`,
    [ticketId],
  );
}
