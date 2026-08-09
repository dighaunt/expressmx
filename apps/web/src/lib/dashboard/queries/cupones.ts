import 'server-only';
import { query, queryOne } from '@expressmx/database';

export type TipoDescuento = 'porcentaje' | 'monto_fijo';

export type EstadoCupon = 'activo' | 'agotado' | 'expirado' | 'futuro';

export interface CuponRow {
  id: string;
  codigo: string;
  tipo_descuento: TipoDescuento;
  valor: string;
  fecha_inicio: string;
  fecha_expiracion: string;
  usos_maximos: number;
  usos_actuales: number;
  solo_primera_compra: boolean;
  categoria_id: string | null;
  categoria_nombre: string | null;
  estado: EstadoCupon;
}

const ESTADO_SQL = `
  CASE
    WHEN c.fecha_inicio > CURRENT_DATE THEN 'futuro'
    WHEN c.fecha_expiracion < CURRENT_DATE THEN 'expirado'
    WHEN c.usos_actuales >= c.usos_maximos THEN 'agotado'
    ELSE 'activo'
  END
`;

export interface CuponesFilter {
  estado?: 'todos' | EstadoCupon;
  q?: string;
  limit?: number;
  offset?: number;
}

export async function listarCupones(filter: CuponesFilter = {}): Promise<{
  total: number;
  rows: CuponRow[];
}> {
  const where: string[] = [];
  const args: unknown[] = [];

  if (filter.estado && filter.estado !== 'todos') {
    args.push(filter.estado);
    where.push(`(${ESTADO_SQL}) = $${args.length}`);
  }
  if (filter.q && filter.q.trim()) {
    args.push(`%${filter.q.trim().toUpperCase()}%`);
    where.push(`UPPER(c.codigo) LIKE $${args.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);

  const totalRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*) AS total FROM cupones c ${whereSql}`,
    args,
  );

  args.push(limit, offset);
  const rows = await query<CuponRow>(
    `SELECT
       c.id, c.codigo, c.tipo_descuento, c.valor,
       to_char(c.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
       to_char(c.fecha_expiracion, 'YYYY-MM-DD') AS fecha_expiracion,
       c.usos_maximos, c.usos_actuales,
       c.solo_primera_compra, c.categoria_id,
       cat.nombre AS categoria_nombre,
       (${ESTADO_SQL})::TEXT AS estado
     FROM cupones c
     LEFT JOIN categorias_servicio cat ON cat.id = c.categoria_id
     ${whereSql}
     ORDER BY c.fecha_expiracion DESC
     LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );

  return { total: Number(totalRow?.total ?? 0), rows };
}

export async function getCupon(id: string): Promise<CuponRow | null> {
  return queryOne<CuponRow>(
    `SELECT
       c.id, c.codigo, c.tipo_descuento, c.valor,
       to_char(c.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
       to_char(c.fecha_expiracion, 'YYYY-MM-DD') AS fecha_expiracion,
       c.usos_maximos, c.usos_actuales,
       c.solo_primera_compra, c.categoria_id,
       cat.nombre AS categoria_nombre,
       (${ESTADO_SQL})::TEXT AS estado
     FROM cupones c
     LEFT JOIN categorias_servicio cat ON cat.id = c.categoria_id
     WHERE c.id = $1`,
    [id],
  );
}
