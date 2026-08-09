import 'server-only';
import { query } from '@expressmx/database';

export type TipoRecordatorio =
  | 'callback_cliente'
  | 'follow_up_interno'
  | 'reabrir_ticket'
  | 'ejecutar_tarea';

export interface RecordatorioRow {
  id: string;
  ticket_id: string;
  tipo: TipoRecordatorio;
  disparar_at: string;
  para_user: string;
  para_user_nombre: string | null;
  asunto: string;
  notas_md: string | null;
  creado_por: string;
  creado_por_nombre: string | null;
  disparado_at: string | null;
  cancelado_at: string | null;
  created_at: string;
}

export async function recordatoriosPendientesPorTicket(
  ticketId: string,
): Promise<RecordatorioRow[]> {
  return await query<RecordatorioRow>(
    `SELECT
       r.id,
       r.ticket_id,
       r.tipo::text AS tipo,
       r.disparar_at,
       r.para_user,
       (up.nombre || ' ' || up.apellidos) AS para_user_nombre,
       r.asunto,
       r.notas_md,
       r.creado_por,
       (uc.nombre || ' ' || uc.apellidos) AS creado_por_nombre,
       r.disparado_at,
       r.cancelado_at,
       r.created_at
     FROM recordatorios_soporte r
     LEFT JOIN usuarios up ON up.id = r.para_user
     LEFT JOIN usuarios uc ON uc.id = r.creado_por
     WHERE r.ticket_id = $1
     ORDER BY
       CASE
         WHEN r.cancelado_at IS NOT NULL THEN 3
         WHEN r.disparado_at IS NOT NULL THEN 2
         ELSE 1
       END,
       r.disparar_at ASC`,
    [ticketId],
  );
}

export async function recordatoriosPendientesParaUser(
  userId: string,
  limit = 20,
): Promise<RecordatorioRow[]> {
  return await query<RecordatorioRow>(
    `SELECT
       r.id,
       r.ticket_id,
       r.tipo::text AS tipo,
       r.disparar_at,
       r.para_user,
       (up.nombre || ' ' || up.apellidos) AS para_user_nombre,
       r.asunto,
       r.notas_md,
       r.creado_por,
       (uc.nombre || ' ' || uc.apellidos) AS creado_por_nombre,
       r.disparado_at,
       r.cancelado_at,
       r.created_at
     FROM recordatorios_soporte r
     LEFT JOIN usuarios up ON up.id = r.para_user
     LEFT JOIN usuarios uc ON uc.id = r.creado_por
     WHERE r.para_user = $1
       AND r.disparado_at IS NULL
       AND r.cancelado_at IS NULL
     ORDER BY r.disparar_at ASC
     LIMIT $2`,
    [userId, limit],
  );
}
