import 'server-only';
import { query, queryOne } from '@expressmx/database';
import type { EstatusCorte, EstatusDeposito } from '@/lib/dashboard/finanzas-shared';

export interface CorteListItem {
  id: string;
  prestador_id: string;
  prestador_nombre: string;
  prestador_email: string;
  fecha_corte: string;
  fecha_deposito: string | null;
  monto_total: string;
  num_transacciones: number;
  estatus: EstatusCorte;
  referencia_bancaria: string | null;
  created_at: string;
}

export interface CorteDetail extends CorteListItem {
  aprobado_por: string | null;
  aprobado_por_nombre: string | null;
  cuenta_bancaria_titular: string | null;
  cuenta_bancaria_banco_codigo: string | null;
  cuenta_bancaria_banco: string | null;
  cuenta_bancaria_clabe_ultimos4: string | null;
  cuenta_bancaria_clabe_ciphertext: string | null;
  cuenta_bancaria_estatus: 'pendiente' | 'verificada' | 'rechazada' | null;
}

export interface TransaccionDelCorte {
  id: string;
  orden_id: string;
  pago_id: string;
  monto_prestador: string;
  comision_plataforma: string;
  estatus_deposito: EstatusDeposito;
  referencia_bancaria: string | null;
  created_at: string;
}

export interface CortesFilter {
  q?: string;
  estatus?: EstatusCorte | 'todos';
  prestadorId?: string;
  desde?: string;
  hasta?: string;
  limit?: number;
  offset?: number;
}

export async function listarCortes(filter: CortesFilter = {}): Promise<{
  total: number;
  rows: CorteListItem[];
  totales: { generado: string; revisado: string; depositado: string };
}> {
  const where: string[] = [];
  const args: unknown[] = [];

  if (filter.q && filter.q.trim()) {
    args.push(`%${filter.q.trim().toLowerCase()}%`);
    where.push(
      `(LOWER(u.nombre || ' ' || u.apellidos) LIKE $${args.length} OR LOWER(u.email) LIKE $${args.length} OR LOWER(c.referencia_bancaria) LIKE $${args.length})`,
    );
  }
  if (filter.estatus && filter.estatus !== 'todos') {
    args.push(filter.estatus);
    where.push(`c.estatus = $${args.length}::estatus_corte`);
  }
  if (filter.prestadorId) {
    args.push(filter.prestadorId);
    where.push(`c.prestador_id = $${args.length}`);
  }
  if (filter.desde) {
    args.push(filter.desde);
    where.push(`c.fecha_corte >= $${args.length}::date`);
  }
  if (filter.hasta) {
    args.push(filter.hasta);
    where.push(`c.fecha_corte <= $${args.length}::date`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);

  const totalRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*) AS total
     FROM cortes_pago c
     LEFT JOIN usuarios u ON u.id = c.prestador_id
     ${whereSql}`,
    args,
  );

  const sumRows = await query<{ estatus: EstatusCorte; total: string }>(
    `SELECT c.estatus::text AS estatus, COALESCE(SUM(c.monto_total), 0)::text AS total
     FROM cortes_pago c
     LEFT JOIN usuarios u ON u.id = c.prestador_id
     ${whereSql}
     GROUP BY c.estatus`,
    args,
  );
  const totales = { generado: '0', revisado: '0', depositado: '0' };
  for (const r of sumRows) {
    if (r.estatus in totales) totales[r.estatus as keyof typeof totales] = r.total;
  }

  args.push(limit, offset);
  const rows = await query<CorteListItem>(
    `SELECT
       c.id,
       c.prestador_id,
       u.nombre || ' ' || u.apellidos AS prestador_nombre,
       u.email AS prestador_email,
       to_char(c.fecha_corte, 'YYYY-MM-DD') AS fecha_corte,
       to_char(c.fecha_deposito, 'YYYY-MM-DD') AS fecha_deposito,
       c.monto_total::text AS monto_total,
       c.num_transacciones,
       c.estatus::text AS estatus,
       c.referencia_bancaria,
       c.created_at
     FROM cortes_pago c
     LEFT JOIN usuarios u ON u.id = c.prestador_id
     ${whereSql}
     ORDER BY c.fecha_corte DESC, c.created_at DESC
     LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );

  return { total: Number(totalRow?.total ?? 0), rows, totales };
}

export async function getCorte(id: string): Promise<CorteDetail | null> {
  return await queryOne<CorteDetail>(
    `SELECT
       c.id,
       c.prestador_id,
       u.nombre || ' ' || u.apellidos AS prestador_nombre,
       u.email AS prestador_email,
       to_char(c.fecha_corte, 'YYYY-MM-DD') AS fecha_corte,
       to_char(c.fecha_deposito, 'YYYY-MM-DD') AS fecha_deposito,
       c.monto_total::text AS monto_total,
       c.num_transacciones,
       c.estatus::text AS estatus,
       c.referencia_bancaria,
       c.created_at,
       c.aprobado_por,
       ap.nombre || ' ' || ap.apellidos AS aprobado_por_nombre,
       cb.titular AS cuenta_bancaria_titular,
       cb.banco_codigo AS cuenta_bancaria_banco_codigo,
       cb.banco_nombre AS cuenta_bancaria_banco,
       cb.clabe_ultimos4 AS cuenta_bancaria_clabe_ultimos4,
       cb.clabe_ciphertext AS cuenta_bancaria_clabe_ciphertext,
       cb.estatus AS cuenta_bancaria_estatus
     FROM cortes_pago c
     LEFT JOIN usuarios u ON u.id = c.prestador_id
     LEFT JOIN usuarios ap ON ap.id = c.aprobado_por
     LEFT JOIN cuentas_bancarias_prestador cb ON cb.prestador_id = c.prestador_id
     WHERE c.id = $1`,
    [id],
  );
}

export async function listarTransaccionesDelCorte(
  prestadorId: string,
  fechaCorte: string,
): Promise<TransaccionDelCorte[]> {
  return await query<TransaccionDelCorte>(
    `SELECT
       t.id,
       t.orden_id,
       t.pago_id,
       t.monto_prestador::text AS monto_prestador,
       t.comision_plataforma::text AS comision_plataforma,
       t.estatus_deposito::text AS estatus_deposito,
       t.referencia_bancaria,
       t.created_at
     FROM transacciones_prestador t
     WHERE t.prestador_id = $1
       AND DATE(t.created_at) <= $2::date
     ORDER BY t.created_at DESC
     LIMIT 200`,
    [prestadorId, fechaCorte],
  );
}
