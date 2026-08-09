import 'server-only';
import { query, queryOne } from '@expressmx/database';
import type { EstatusFactura } from '@/lib/dashboard/finanzas-shared';

export interface FacturaListItem {
  id: string;
  rfc_emisor: string;
  rfc_receptor: string;
  uuid_cfdi: string | null;
  subtotal: string;
  iva: string;
  total: string;
  estatus: EstatusFactura;
  pdf_url: string | null;
  xml_url: string | null;
  created_at: string;
  orden_id: string | null;
  corte_id: string | null;
}

export interface FacturasFilter {
  q?: string;
  estatus?: EstatusFactura | 'todos';
  desde?: string;
  hasta?: string;
  limit?: number;
  offset?: number;
}

export async function listarFacturas(filter: FacturasFilter = {}): Promise<{
  total: number;
  rows: FacturaListItem[];
  totales: { timbrada: string; cancelada: string };
}> {
  const where: string[] = [];
  const args: unknown[] = [];

  if (filter.q && filter.q.trim()) {
    args.push(`%${filter.q.trim().toUpperCase()}%`);
    where.push(
      `(UPPER(f.rfc_emisor) LIKE $${args.length} OR UPPER(f.rfc_receptor) LIKE $${args.length} OR UPPER(f.uuid_cfdi) LIKE $${args.length})`,
    );
  }
  if (filter.estatus && filter.estatus !== 'todos') {
    args.push(filter.estatus);
    where.push(`f.estatus = $${args.length}::estatus_factura`);
  }
  if (filter.desde) {
    args.push(filter.desde);
    where.push(`f.created_at >= $${args.length}::timestamptz`);
  }
  if (filter.hasta) {
    args.push(filter.hasta);
    where.push(`f.created_at < $${args.length}::timestamptz + INTERVAL '1 day'`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);

  const totalRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*) AS total FROM facturas f ${whereSql}`,
    args,
  );

  const sumRows = await query<{ estatus: EstatusFactura; total: string }>(
    `SELECT f.estatus::text AS estatus, COALESCE(SUM(f.total), 0)::text AS total
     FROM facturas f
     ${whereSql}
     GROUP BY f.estatus`,
    args,
  );
  const totales = { timbrada: '0', cancelada: '0' };
  for (const r of sumRows) {
    if (r.estatus in totales) totales[r.estatus as keyof typeof totales] = r.total;
  }

  args.push(limit, offset);
  const rows = await query<FacturaListItem>(
    `SELECT
       f.id,
       f.rfc_emisor,
       f.rfc_receptor,
       f.uuid_cfdi,
       f.subtotal::text AS subtotal,
       f.iva::text AS iva,
       f.total::text AS total,
       f.estatus::text AS estatus,
       f.pdf_url,
       f.xml_url,
       f.created_at,
       f.orden_id,
       f.corte_id
     FROM facturas f
     ${whereSql}
     ORDER BY f.created_at DESC
     LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );

  return { total: Number(totalRow?.total ?? 0), rows, totales };
}

export async function getFactura(id: string): Promise<FacturaListItem | null> {
  return await queryOne<FacturaListItem>(
    `SELECT
       f.id,
       f.rfc_emisor,
       f.rfc_receptor,
       f.uuid_cfdi,
       f.subtotal::text AS subtotal,
       f.iva::text AS iva,
       f.total::text AS total,
       f.estatus::text AS estatus,
       f.pdf_url,
       f.xml_url,
       f.created_at,
       f.orden_id,
       f.corte_id
     FROM facturas f
     WHERE f.id = $1`,
    [id],
  );
}
