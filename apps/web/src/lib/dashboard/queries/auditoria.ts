import 'server-only';
import { query, queryOne } from '@expressmx/database';

export interface LogAuditoriaItem {
  id: string;
  admin_id: string;
  admin_nombre: string;
  admin_email: string;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  valor_anterior: unknown | null;
  valor_nuevo: unknown | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditoriaFilter {
  q?: string;
  adminId?: string;
  entidad?: string;
  desde?: string;
  hasta?: string;
  limit?: number;
  offset?: number;
}

export async function listarLogs(filter: AuditoriaFilter = {}): Promise<{
  total: number;
  rows: LogAuditoriaItem[];
}> {
  const where: string[] = [];
  const args: unknown[] = [];

  if (filter.q && filter.q.trim()) {
    args.push(`%${filter.q.trim().toLowerCase()}%`);
    where.push(
      `(LOWER(l.accion) LIKE $${args.length} OR LOWER(l.entidad) LIKE $${args.length})`,
    );
  }
  if (filter.adminId) {
    args.push(filter.adminId);
    where.push(`l.admin_id = $${args.length}`);
  }
  if (filter.entidad && filter.entidad.trim()) {
    args.push(filter.entidad.trim().toLowerCase());
    where.push(`LOWER(l.entidad) = $${args.length}`);
  }
  if (filter.desde) {
    args.push(filter.desde);
    where.push(`l.created_at >= $${args.length}::timestamptz`);
  }
  if (filter.hasta) {
    args.push(filter.hasta);
    where.push(`l.created_at < $${args.length}::timestamptz + INTERVAL '1 day'`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);

  const totalRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*) AS total FROM logs_auditoria l ${whereSql}`,
    args,
  );

  args.push(limit, offset);
  const rows = await query<LogAuditoriaItem>(
    `SELECT
       l.id,
       l.admin_id,
       u.nombre || ' ' || u.apellidos AS admin_nombre,
       u.email AS admin_email,
       l.accion,
       l.entidad,
       l.entidad_id,
       l.valor_anterior,
       l.valor_nuevo,
       l.ip_address::text AS ip_address,
       l.user_agent,
       l.created_at
     FROM logs_auditoria l
     LEFT JOIN usuarios u ON u.id = l.admin_id
     ${whereSql}
     ORDER BY l.created_at DESC
     LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );

  return { total: Number(totalRow?.total ?? 0), rows };
}

export async function listarEntidadesAuditadas(): Promise<string[]> {
  const rows = await query<{ entidad: string }>(
    `SELECT DISTINCT entidad FROM logs_auditoria ORDER BY entidad`,
  );
  return rows.map((r) => r.entidad);
}

export async function listarAdminsAuditados(): Promise<
  Array<{ id: string; nombre: string; email: string }>
> {
  return await query<{ id: string; nombre: string; email: string }>(
    `SELECT DISTINCT u.id, u.nombre || ' ' || u.apellidos AS nombre, u.email
     FROM logs_auditoria l
     JOIN usuarios u ON u.id = l.admin_id
     ORDER BY nombre`,
  );
}
