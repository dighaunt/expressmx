import 'server-only';
import { query, queryOne } from '@expressmx/database';

export interface ClienteListItem {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  activo: boolean;
  restringido: boolean;
  ordenes_total: number;
  created_at: string;
}

export interface ClienteDetail extends ClienteListItem {
  curp: string | null;
  fecha_nacimiento: string | null;
  motivo_restriccion: string | null;
  restringido_en: string | null;
  avatar_url: string | null;
  ultima_orden_at: string | null;
}

export interface ClientesFilter {
  q?: string;
  estado?: 'todos' | 'activos' | 'restringidos' | 'inactivos';
  limit?: number;
  offset?: number;
}

export async function listarClientes(filter: ClientesFilter = {}): Promise<{
  total: number;
  rows: ClienteListItem[];
}> {
  const where: string[] = [`u.rol = 'cliente'`];
  const args: unknown[] = [];

  if (filter.q && filter.q.trim()) {
    args.push(`%${filter.q.trim().toLowerCase()}%`);
    where.push(
      `(LOWER(u.nombre || ' ' || u.apellidos) LIKE $${args.length} OR LOWER(u.email) LIKE $${args.length} OR u.telefono LIKE $${args.length})`,
    );
  }
  if (filter.estado === 'activos') {
    where.push(`u.activo = TRUE AND u.restringido_en IS NULL`);
  } else if (filter.estado === 'restringidos') {
    where.push(`u.restringido_en IS NOT NULL`);
  } else if (filter.estado === 'inactivos') {
    where.push(`u.activo = FALSE`);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);

  const totalRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*) AS total FROM usuarios u ${whereSql}`,
    args,
  );

  args.push(limit, offset);
  const rows = await query<ClienteListItem>(
    `SELECT
       u.id,
       u.nombre,
       u.apellidos,
       u.email,
       u.telefono,
       u.activo,
       (u.restringido_en IS NOT NULL) AS restringido,
       u.created_at,
       (SELECT COUNT(*) FROM ordenes_servicio o WHERE o.cliente_id = u.id)::INT AS ordenes_total
     FROM usuarios u
     ${whereSql}
     ORDER BY u.created_at DESC
     LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );

  return { total: Number(totalRow?.total ?? 0), rows };
}

export async function getCliente(id: string): Promise<ClienteDetail | null> {
  const row = await queryOne<ClienteDetail>(
    `SELECT
       u.id,
       u.nombre,
       u.apellidos,
       u.email,
       u.telefono,
       u.activo,
       u.curp,
       to_char(u.fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento,
       u.avatar_url,
       u.motivo_restriccion,
       u.restringido_en,
       (u.restringido_en IS NOT NULL) AS restringido,
       u.created_at,
       (SELECT COUNT(*) FROM ordenes_servicio o WHERE o.cliente_id = u.id)::INT AS ordenes_total,
       (SELECT MAX(created_at) FROM ordenes_servicio o WHERE o.cliente_id = u.id) AS ultima_orden_at
     FROM usuarios u
     WHERE u.id = $1 AND u.rol = 'cliente'`,
    [id],
  );
  return row;
}
