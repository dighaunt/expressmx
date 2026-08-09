import 'server-only';
import { query } from '@expressmx/database';

export type TipoTareaCaso =
  | 'reembolso'
  | 'cfdi_cancelacion'
  | 'cfdi_reemision'
  | 'credito_aplicacion'
  | 'reasignar_prestador'
  | 'investigacion_pago'
  | 'callback_cliente'
  | 'verificacion_id'
  | 'follow_up_interno';

export type EstadoTareaCaso =
  | 'abierta'
  | 'en_progreso'
  | 'esperando_aprobacion'
  | 'bloqueada'
  | 'completada'
  | 'cancelada';

export interface TareaCaso {
  id: string;
  ticket_id: string;
  tipo: TipoTareaCaso;
  estado: EstadoTareaCaso;
  asunto: string;
  descripcion_md: string | null;
  payload: Record<string, unknown>;
  asignado_a: string | null;
  asignado_nombre: string | null;
  grupo_asignado: string;
  creado_por: string;
  creado_por_nombre: string;
  vence_at: string | null;
  bloqueante: boolean;
  completada_at: string | null;
  completada_por: string | null;
  resultado_md: string | null;
  visible_cliente: boolean;
  titulo_cliente: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT_TAREA = `
  SELECT
    t.id, t.ticket_id, t.tipo::text AS tipo, t.estado::text AS estado,
    t.asunto, t.descripcion_md, t.payload,
    t.asignado_a,
    asign.nombre || ' ' || asign.apellidos AS asignado_nombre,
    t.grupo_asignado,
    t.creado_por,
    creator.nombre || ' ' || creator.apellidos AS creado_por_nombre,
    t.vence_at, t.bloqueante,
    t.completada_at, t.completada_por,
    t.resultado_md,
    t.visible_cliente, t.titulo_cliente,
    t.created_at, t.updated_at
  FROM tareas_caso t
  LEFT JOIN usuarios asign ON asign.id = t.asignado_a
  LEFT JOIN usuarios creator ON creator.id = t.creado_por
`;

export async function listarTareasPorTicket(ticketId: string): Promise<TareaCaso[]> {
  const rows = await query<TareaCaso>(
    `${SELECT_TAREA}
       WHERE t.ticket_id = $1
       ORDER BY
         CASE t.estado
           WHEN 'abierta' THEN 1
           WHEN 'en_progreso' THEN 2
           WHEN 'esperando_aprobacion' THEN 3
           WHEN 'bloqueada' THEN 4
           WHEN 'completada' THEN 5
           WHEN 'cancelada' THEN 6
         END,
         t.created_at DESC`,
    [ticketId],
  );
  return rows;
}

export async function listarTareasPorGrupo(
  grupo: string | string[],
  opts: { limit?: number; soloActivas?: boolean } = {},
): Promise<TareaCaso[]> {
  const { limit = 50, soloActivas = true } = opts;
  const filtroEstado = soloActivas
    ? `AND t.estado IN ('abierta','en_progreso','esperando_aprobacion','bloqueada')`
    : '';
  const grupos = Array.isArray(grupo) ? grupo : [grupo];
  const rows = await query<TareaCaso>(
    `${SELECT_TAREA}
       WHERE t.grupo_asignado = ANY($1::text[])
         ${filtroEstado}
       ORDER BY
         CASE WHEN t.vence_at IS NULL THEN 1 ELSE 0 END,
         t.vence_at ASC,
         t.created_at DESC
       LIMIT $2`,
    [grupos, limit],
  );
  return rows;
}

export async function listarTareasMias(
  userId: string,
  opts: { limit?: number; soloActivas?: boolean } = {},
): Promise<TareaCaso[]> {
  const { limit = 50, soloActivas = true } = opts;
  const filtroEstado = soloActivas
    ? `AND t.estado IN ('abierta','en_progreso','esperando_aprobacion','bloqueada')`
    : '';
  const rows = await query<TareaCaso>(
    `${SELECT_TAREA}
       WHERE t.asignado_a = $1
         ${filtroEstado}
       ORDER BY
         CASE WHEN t.vence_at IS NULL THEN 1 ELSE 0 END,
         t.vence_at ASC,
         t.created_at DESC
       LIMIT $2`,
    [userId, limit],
  );
  return rows;
}
