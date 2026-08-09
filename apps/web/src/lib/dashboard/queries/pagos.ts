import 'server-only';
import { query, queryOne } from '@expressmx/database';
import type {
  EstatusPago,
  MetodoPago,
} from '@/lib/dashboard/finanzas-shared';

export interface PagoListItem {
  id: string;
  orden_id: string;
  cliente_nombre: string | null;
  cliente_email: string | null;
  prestador_nombre: string | null;
  monto: string;
  metodo: MetodoPago;
  estatus: EstatusPago;
  referencia_pasarela: string | null;
  created_at: string;
}

export interface PagoDetail extends PagoListItem {
  orden_estatus: string | null;
  orden_total: string | null;
  servicio_nombre: string | null;
  reembolso_estatus: string | null;
  reembolso_id: string | null;
  reembolso_monto: string | null;
}

export interface PagosFilter {
  q?: string;
  estatus?: EstatusPago | 'todos';
  metodo?: MetodoPago | 'todos';
  desde?: string;
  hasta?: string;
  limit?: number;
  offset?: number;
}

export async function listarPagos(filter: PagosFilter = {}): Promise<{
  total: number;
  rows: PagoListItem[];
  totales: { procesado: string; pendiente: string; reembolsado: string };
}> {
  const where: string[] = [];
  const args: unknown[] = [];

  if (filter.q && filter.q.trim()) {
    args.push(`%${filter.q.trim().toLowerCase()}%`);
    where.push(
      `(LOWER(p.referencia_pasarela) LIKE $${args.length} OR p.orden_id::text LIKE $${args.length} OR LOWER(uc.email) LIKE $${args.length})`,
    );
  }
  if (filter.estatus && filter.estatus !== 'todos') {
    args.push(filter.estatus);
    where.push(`p.estatus = $${args.length}::estatus_pago`);
  }
  if (filter.metodo && filter.metodo !== 'todos') {
    args.push(filter.metodo);
    where.push(`p.metodo = $${args.length}::metodo_pago`);
  }
  if (filter.desde) {
    args.push(filter.desde);
    where.push(`p.created_at >= $${args.length}::timestamptz`);
  }
  if (filter.hasta) {
    args.push(filter.hasta);
    where.push(`p.created_at < $${args.length}::timestamptz + INTERVAL '1 day'`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);

  const totalRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*) AS total
     FROM pagos p
     LEFT JOIN ordenes_servicio o ON o.id = p.orden_id
     LEFT JOIN usuarios uc ON uc.id = o.cliente_id
     ${whereSql}`,
    args,
  );

  const sumRows = await query<{ estatus: EstatusPago; total: string }>(
    `SELECT p.estatus::text AS estatus, COALESCE(SUM(p.monto), 0)::text AS total
     FROM pagos p
     LEFT JOIN ordenes_servicio o ON o.id = p.orden_id
     LEFT JOIN usuarios uc ON uc.id = o.cliente_id
     ${whereSql}
     GROUP BY p.estatus`,
    args,
  );

  const totales = { procesado: '0', pendiente: '0', reembolsado: '0' };
  for (const row of sumRows) {
    if (row.estatus in totales) {
      totales[row.estatus as keyof typeof totales] = row.total;
    }
  }

  args.push(limit, offset);
  const rows = await query<PagoListItem>(
    `SELECT
       p.id,
       p.orden_id,
       uc.nombre || ' ' || uc.apellidos AS cliente_nombre,
       uc.email AS cliente_email,
       up.nombre || ' ' || up.apellidos AS prestador_nombre,
       p.monto::text AS monto,
       p.metodo::text AS metodo,
       p.estatus::text AS estatus,
       p.referencia_pasarela,
       p.created_at
     FROM pagos p
     LEFT JOIN ordenes_servicio o ON o.id = p.orden_id
     LEFT JOIN usuarios uc ON uc.id = o.cliente_id
     LEFT JOIN usuarios up ON up.id = o.prestador_id
     ${whereSql}
     ORDER BY p.created_at DESC
     LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );

  return { total: Number(totalRow?.total ?? 0), rows, totales };
}

export async function getPago(id: string): Promise<PagoDetail | null> {
  return await queryOne<PagoDetail>(
    `SELECT
       p.id,
       p.orden_id,
       uc.nombre || ' ' || uc.apellidos AS cliente_nombre,
       uc.email AS cliente_email,
       up.nombre || ' ' || up.apellidos AS prestador_nombre,
       p.monto::text AS monto,
       p.metodo::text AS metodo,
       p.estatus::text AS estatus,
       p.referencia_pasarela,
       p.created_at,
       o.estatus::text AS orden_estatus,
       o.monto_total::text AS orden_total,
       s.nombre AS servicio_nombre,
       r.id AS reembolso_id,
       r.estatus::text AS reembolso_estatus,
       r.monto::text AS reembolso_monto
     FROM pagos p
     LEFT JOIN ordenes_servicio o ON o.id = p.orden_id
     LEFT JOIN usuarios uc ON uc.id = o.cliente_id
     LEFT JOIN usuarios up ON up.id = o.prestador_id
     LEFT JOIN servicios s ON s.id = o.servicio_id
     LEFT JOIN LATERAL (
       SELECT id, estatus, monto FROM reembolsos
       WHERE pago_id = p.id
       ORDER BY created_at DESC
       LIMIT 1
     ) r ON TRUE
     WHERE p.id = $1`,
    [id],
  );
}
