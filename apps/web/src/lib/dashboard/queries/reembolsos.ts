import 'server-only';
import { query, queryOne } from '@expressmx/database';

export type EstatusReembolso = 'solicitado' | 'aprobado' | 'rechazado' | 'procesado';

export const ESTATUS_REEMBOLSO_LABEL: Record<EstatusReembolso, string> = {
  solicitado: 'Solicitado',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  procesado: 'Procesado',
};

export interface ReembolsoRow {
  id: string;
  pago_id: string;
  ticket_id: string | null;
  monto: string;
  motivo: string;
  estatus: EstatusReembolso;
  referencia_pasarela: string | null;
  aprobado_por: string | null;
  aprobado_por_nombre: string | null;
  payment_intent_id: string | null;
  cliente_nombre: string;
  orden_id: string;
  servicio_nombre: string;
  monto_pago: string;
  created_at: string;
}

export interface ReembolsosFilter {
  estatus?: EstatusReembolso | 'todos';
  q?: string;
  limit?: number;
  offset?: number;
}

export async function listarReembolsos(filter: ReembolsosFilter = {}): Promise<{
  total: number;
  rows: ReembolsoRow[];
}> {
  const where: string[] = [];
  const args: unknown[] = [];

  if (filter.estatus && filter.estatus !== 'todos') {
    args.push(filter.estatus);
    where.push(`r.estatus = $${args.length}::estatus_reembolso`);
  }
  if (filter.q && filter.q.trim()) {
    args.push(`%${filter.q.trim().toLowerCase()}%`);
    where.push(
      `(LOWER(r.motivo) LIKE $${args.length} OR LOWER(c.nombre || ' ' || c.apellidos) LIKE $${args.length})`,
    );
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);

  const totalRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*) AS total
     FROM reembolsos r
     JOIN pagos p ON p.id = r.pago_id
     JOIN ordenes_servicio o ON o.id = p.orden_id
     JOIN usuarios c ON c.id = o.cliente_id
     ${whereSql}`,
    args,
  );

  args.push(limit, offset);
  const rows = await query<ReembolsoRow>(
    `SELECT
       r.id, r.pago_id, r.ticket_id, r.monto, r.motivo, r.estatus,
       r.referencia_pasarela, r.aprobado_por, r.created_at,
       (c.nombre || ' ' || c.apellidos) AS cliente_nombre,
       o.id AS orden_id,
       s.nombre AS servicio_nombre,
       p.monto AS monto_pago,
       p.payment_intent_id,
       (CASE WHEN ap.id IS NULL THEN NULL
             ELSE ap.nombre || ' ' || COALESCE(LEFT(ap.apellidos, 1) || '.', '') END) AS aprobado_por_nombre
     FROM reembolsos r
     JOIN pagos p ON p.id = r.pago_id
     JOIN ordenes_servicio o ON o.id = p.orden_id
     JOIN servicios s ON s.id = o.servicio_id
     JOIN usuarios c ON c.id = o.cliente_id
     LEFT JOIN usuarios ap ON ap.id = r.aprobado_por
     ${whereSql}
     ORDER BY
       CASE r.estatus WHEN 'solicitado' THEN 0 WHEN 'aprobado' THEN 1 ELSE 2 END,
       r.created_at DESC
     LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );

  return { total: Number(totalRow?.total ?? 0), rows };
}

export async function getReembolso(id: string): Promise<ReembolsoRow | null> {
  return queryOne<ReembolsoRow>(
    `SELECT
       r.id, r.pago_id, r.ticket_id, r.monto, r.motivo, r.estatus,
       r.referencia_pasarela, r.aprobado_por, r.created_at,
       (c.nombre || ' ' || c.apellidos) AS cliente_nombre,
       o.id AS orden_id,
       s.nombre AS servicio_nombre,
       p.monto AS monto_pago,
       p.payment_intent_id,
       (CASE WHEN ap.id IS NULL THEN NULL
             ELSE ap.nombre || ' ' || COALESCE(LEFT(ap.apellidos, 1) || '.', '') END) AS aprobado_por_nombre
     FROM reembolsos r
     JOIN pagos p ON p.id = r.pago_id
     JOIN ordenes_servicio o ON o.id = p.orden_id
     JOIN servicios s ON s.id = o.servicio_id
     JOIN usuarios c ON c.id = o.cliente_id
     LEFT JOIN usuarios ap ON ap.id = r.aprobado_por
     WHERE r.id = $1`,
    [id],
  );
}
