import 'server-only';
import { query, queryOne } from '@expressmx/database';

export interface ComplianceQueueCounts {
  eventos_hoy: number;
  eventos_7d: number;
  acciones_propias_hoy: number;
  alertas_sod: number;
}

export async function getComplianceQueueCounts(
  viewerId: string,
): Promise<ComplianceQueueCounts> {
  const row = await queryOne<ComplianceQueueCounts>(
    `SELECT
       (SELECT COUNT(*) FROM logs_auditoria
        WHERE DATE(created_at) = CURRENT_DATE)::INT AS eventos_hoy,
       (SELECT COUNT(*) FROM logs_auditoria
        WHERE created_at >= NOW() - INTERVAL '7 days')::INT AS eventos_7d,
       (SELECT COUNT(*) FROM logs_auditoria
        WHERE admin_id = $1 AND DATE(created_at) = CURRENT_DATE)::INT AS acciones_propias_hoy,
       (SELECT COUNT(*) FROM (
         SELECT r.id
         FROM reembolsos r
         JOIN logs_auditoria la_proc ON la_proc.entidad_id = r.id
           AND la_proc.accion = 'reembolso.procesado'
         WHERE r.aprobado_por = la_proc.admin_id
           AND la_proc.created_at >= NOW() - INTERVAL '90 days'
       ) sod)::INT AS alertas_sod`,
    [viewerId],
  );
  return (
    row ?? {
      eventos_hoy: 0,
      eventos_7d: 0,
      acciones_propias_hoy: 0,
      alertas_sod: 0,
    }
  );
}

export type ComplianceBucket =
  | 'eventos_hoy'
  | 'eventos_7d'
  | 'mis_acciones'
  | 'alertas_sod';

export interface ComplianceEvento {
  id: string;
  admin_id: string;
  admin_nombre: string;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  caso_id: string | null;
  ticket_id: string | null;
  ip_address: string | null;
  created_at: string;
  alerta?: string;
}

export async function listarColaCompliance(
  viewerId: string,
  bucket: ComplianceBucket,
  filtros: { adminId?: string; entidad?: string; q?: string } = {},
  limit = 50,
): Promise<ComplianceEvento[]> {
  if (bucket === 'alertas_sod') {
    return await query<ComplianceEvento>(
      `SELECT
         la.id,
         la.admin_id,
         u.nombre || ' ' || u.apellidos AS admin_nombre,
         la.accion,
         la.entidad,
         la.entidad_id,
         la.caso_id,
         la.ticket_id,
         la.ip_address::text AS ip_address,
         la.created_at,
         'mismo_aprobador_y_procesador' AS alerta
       FROM logs_auditoria la
       JOIN usuarios u ON u.id = la.admin_id
       JOIN reembolsos r ON r.id = la.entidad_id
         AND r.aprobado_por = la.admin_id
       WHERE la.accion = 'reembolso.procesado'
         AND la.created_at >= NOW() - INTERVAL '90 days'
       ORDER BY la.created_at DESC
       LIMIT $1`,
      [limit],
    );
  }

  const where: string[] = [];
  const args: unknown[] = [];

  if (bucket === 'eventos_hoy') {
    where.push(`DATE(la.created_at) = CURRENT_DATE`);
  } else if (bucket === 'eventos_7d') {
    where.push(`la.created_at >= NOW() - INTERVAL '7 days'`);
  } else {
    args.push(viewerId);
    where.push(`la.admin_id = $${args.length}`);
  }

  if (filtros.adminId) {
    args.push(filtros.adminId);
    where.push(`la.admin_id = $${args.length}`);
  }
  if (filtros.entidad && filtros.entidad.trim()) {
    args.push(filtros.entidad.trim().toLowerCase());
    where.push(`LOWER(la.entidad) = $${args.length}`);
  }
  if (filtros.q && filtros.q.trim()) {
    args.push(`%${filtros.q.trim().toLowerCase()}%`);
    where.push(
      `(LOWER(la.accion) LIKE $${args.length} OR LOWER(la.entidad) LIKE $${args.length})`,
    );
  }

  args.push(limit);
  return await query<ComplianceEvento>(
    `SELECT
       la.id,
       la.admin_id,
       u.nombre || ' ' || u.apellidos AS admin_nombre,
       la.accion,
       la.entidad,
       la.entidad_id,
       la.caso_id,
       la.ticket_id,
       la.ip_address::text AS ip_address,
       la.created_at
     FROM logs_auditoria la
     LEFT JOIN usuarios u ON u.id = la.admin_id
     WHERE ${where.join(' AND ')}
     ORDER BY la.created_at DESC
     LIMIT $${args.length}`,
    args,
  );
}

export interface EventoDetalle extends ComplianceEvento {
  valor_anterior: unknown;
  valor_nuevo: unknown;
  user_agent: string | null;
}

export async function getEventoDetalle(eventoId: string): Promise<EventoDetalle | null> {
  return await queryOne<EventoDetalle>(
    `SELECT
       la.id,
       la.admin_id,
       u.nombre || ' ' || u.apellidos AS admin_nombre,
       la.accion,
       la.entidad,
       la.entidad_id,
       la.caso_id,
       la.ticket_id,
       la.valor_anterior,
       la.valor_nuevo,
       la.ip_address::text AS ip_address,
       la.user_agent,
       la.created_at
     FROM logs_auditoria la
     LEFT JOIN usuarios u ON u.id = la.admin_id
     WHERE la.id = $1`,
    [eventoId],
  );
}

export interface AdminActivo {
  admin_id: string;
  admin_nombre: string;
  total: number;
  ultima_accion: string;
}

export async function topAdminsHoy(limit = 5): Promise<AdminActivo[]> {
  return await query<AdminActivo>(
    `SELECT
       la.admin_id,
       u.nombre || ' ' || u.apellidos AS admin_nombre,
       COUNT(*)::INT AS total,
       MAX(la.created_at) AS ultima_accion
     FROM logs_auditoria la
     LEFT JOIN usuarios u ON u.id = la.admin_id
     WHERE DATE(la.created_at) = CURRENT_DATE
     GROUP BY la.admin_id, u.nombre, u.apellidos
     ORDER BY total DESC
     LIMIT $1`,
    [limit],
  );
}

export interface EntidadActiva {
  entidad: string;
  total: number;
}

export async function topEntidades7d(limit = 8): Promise<EntidadActiva[]> {
  return await query<EntidadActiva>(
    `SELECT entidad, COUNT(*)::INT AS total
     FROM logs_auditoria
     WHERE created_at >= NOW() - INTERVAL '7 days'
     GROUP BY entidad
     ORDER BY total DESC
     LIMIT $1`,
    [limit],
  );
}

export interface AccionesRelacionadas {
  id: string;
  accion: string;
  admin_nombre: string;
  created_at: string;
}

export async function getAccionesDelMismoCaso(
  casoId: string | null,
  ticketId: string | null,
  excludeId: string,
): Promise<AccionesRelacionadas[]> {
  if (!casoId && !ticketId) return [];
  const where: string[] = [`la.id <> $1`];
  const args: unknown[] = [excludeId];
  if (casoId) {
    args.push(casoId);
    where.push(`la.caso_id = $${args.length}`);
  }
  if (ticketId) {
    args.push(ticketId);
    where.push(`la.ticket_id = $${args.length}`);
  }
  return await query<AccionesRelacionadas>(
    `SELECT
       la.id,
       la.accion,
       u.nombre || ' ' || u.apellidos AS admin_nombre,
       la.created_at
     FROM logs_auditoria la
     LEFT JOIN usuarios u ON u.id = la.admin_id
     WHERE ${where.join(' AND ')}
     ORDER BY la.created_at ASC
     LIMIT 30`,
    args,
  );
}
