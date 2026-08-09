import 'server-only';
import { query } from '@expressmx/database';

export type EstadoAprobacion =
  | 'solicitada'
  | 'aprobada'
  | 'rechazada'
  | 'cancelada'
  | 'expirada';

export type EntidadAprobacion =
  | 'reembolsos'
  | 'tareas_caso'
  | 'saldo_cliente_movimientos'
  | 'suspensiones_cuenta';

export interface Aprobacion {
  id: string;
  entidad: EntidadAprobacion;
  entidad_id: string;
  motivo_md: string;
  monto_mxn: string | null;
  solicitado_por: string;
  solicitado_por_nombre: string;
  aprobador_grupo: string;
  aprobador_user: string | null;
  aprobador_nombre: string | null;
  estado: EstadoAprobacion;
  decidida_at: string | null;
  notas_decision_md: string | null;
  expira_at: string;
  created_at: string;
}

const SELECT_APROBACION = `
  SELECT
    a.id, a.entidad, a.entidad_id, a.motivo_md, a.monto_mxn::text AS monto_mxn,
    a.solicitado_por,
    sol.nombre || ' ' || sol.apellidos AS solicitado_por_nombre,
    a.aprobador_grupo, a.aprobador_user,
    aprob.nombre || ' ' || aprob.apellidos AS aprobador_nombre,
    a.estado::text AS estado,
    a.decidida_at, a.notas_decision_md, a.expira_at, a.created_at
  FROM aprobaciones a
  LEFT JOIN usuarios sol ON sol.id = a.solicitado_por
  LEFT JOIN usuarios aprob ON aprob.id = a.aprobador_user
`;

export async function listarPendientesPorGrupo(
  grupo: string,
  limit: number = 50,
): Promise<Aprobacion[]> {
  return await query<Aprobacion>(
    `${SELECT_APROBACION}
       WHERE a.aprobador_grupo = $1
         AND a.estado = 'solicitada'
       ORDER BY a.created_at ASC
       LIMIT $2`,
    [grupo, limit],
  );
}

export async function listarAprobacionesPorEntidad(
  entidad: EntidadAprobacion,
  entidadId: string,
): Promise<Aprobacion[]> {
  return await query<Aprobacion>(
    `${SELECT_APROBACION}
       WHERE a.entidad = $1 AND a.entidad_id = $2
       ORDER BY a.created_at DESC`,
    [entidad, entidadId],
  );
}

export async function listarAprobacionesPorTicket(
  ticketId: string,
): Promise<Aprobacion[]> {
  return await query<Aprobacion>(
    `${SELECT_APROBACION}
       WHERE (a.entidad = 'tareas_caso'
              AND a.entidad_id IN (SELECT id FROM tareas_caso WHERE ticket_id = $1))
          OR (a.entidad = 'reembolsos'
              AND a.entidad_id IN (SELECT id FROM reembolsos WHERE ticket_id = $1))
          OR (a.entidad = 'saldo_cliente_movimientos'
              AND a.entidad_id IN (SELECT id FROM saldo_cliente_movimientos WHERE ticket_id = $1))
          OR (a.entidad = 'suspensiones_cuenta'
              AND a.entidad_id IN (SELECT id FROM suspensiones_cuenta WHERE ticket_id = $1))
       ORDER BY a.created_at DESC`,
    [ticketId],
  );
}
