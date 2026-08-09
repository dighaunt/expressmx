import 'server-only';
import { query, queryOne } from '@expressmx/database';

export type EstatusOrden =
  | 'solicitada'
  | 'asignada'
  | 'en_camino'
  | 'en_progreso'
  | 'completada'
  | 'cancelada';

export const ESTATUS_LABEL: Record<EstatusOrden, string> = {
  solicitada: 'Solicitada',
  asignada: 'Asignada',
  en_camino: 'En camino',
  en_progreso: 'En progreso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export interface OrdenListItem {
  id: string;
  estatus: EstatusOrden;
  fecha_programada: string;
  servicio: string;
  cliente: string;
  prestador: string | null;
  zona: string | null;
  monto_total: string;
  created_at: string;
}

export interface OrdenesFilter {
  estatus?: EstatusOrden;
  q?: string;
  desde?: string;
  hasta?: string;
  limit?: number;
  offset?: number;
}

export async function listarOrdenes(filter: OrdenesFilter = {}): Promise<{
  total: number;
  rows: OrdenListItem[];
}> {
  const where: string[] = [];
  const args: unknown[] = [];

  if (filter.estatus) {
    args.push(filter.estatus);
    where.push(`o.estatus = $${args.length}::estatus_orden`);
  }
  if (filter.q && filter.q.trim()) {
    args.push(`%${filter.q.trim().toLowerCase()}%`);
    where.push(
      `(LOWER(c.nombre || ' ' || c.apellidos) LIKE $${args.length} OR LOWER(s.nombre) LIKE $${args.length} OR o.id::text LIKE $${args.length})`,
    );
  }
  if (filter.desde) {
    args.push(filter.desde);
    where.push(`o.fecha_programada >= $${args.length}`);
  }
  if (filter.hasta) {
    args.push(filter.hasta);
    where.push(`o.fecha_programada <= $${args.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);

  const totalRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*) AS total
     FROM ordenes_servicio o
     JOIN servicios s ON s.id = o.servicio_id
     JOIN usuarios c ON c.id = o.cliente_id
     ${whereSql}`,
    args,
  );

  args.push(limit, offset);
  const rows = await query<OrdenListItem>(
    `SELECT
       o.id,
       o.estatus,
       o.fecha_programada,
       o.created_at,
       o.monto_total,
       s.nombre AS servicio,
       (c.nombre || ' ' || c.apellidos) AS cliente,
       (CASE WHEN p.id IS NULL THEN NULL
             ELSE p.nombre || ' ' || COALESCE(LEFT(p.apellidos, 1) || '.', '') END) AS prestador,
       d.colonia AS zona
     FROM ordenes_servicio o
     JOIN servicios s ON s.id = o.servicio_id
     JOIN usuarios c ON c.id = o.cliente_id
     LEFT JOIN usuarios p ON p.id = o.prestador_id
     LEFT JOIN direcciones d ON d.id = o.direccion_id
     ${whereSql}
     ORDER BY o.fecha_programada DESC, o.id DESC
     LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );

  return {
    total: Number(totalRow?.total ?? 0),
    rows,
  };
}

export interface OrdenDetailHeader {
  id: string;
  estatus: EstatusOrden;
  fecha_programada: string;
  created_at: string;
  monto_total: string;
  descuento: string;
  pin_cliente: string | null;
  pin_prestador: string | null;
  notas_cliente: string | null;
  servicio_id: string;
  servicio_nombre: string;
  servicio_categoria: string | null;
  cliente_id: string;
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono: string | null;
  prestador_id: string | null;
  prestador_nombre: string | null;
  prestador_telefono: string | null;
  direccion_completa: string;
  direccion_referencia: string | null;
  cupon_codigo: string | null;
}

export interface OrdenPagoRow {
  id: string;
  monto: string;
  metodo: string;
  estatus: string;
  raw_status: string | null;
  payment_intent_id: string | null;
  customer_id_pasarela: string | null;
  referencia_pasarela: string | null;
  webhook_received_at: string | null;
  created_at: string;
}

export interface OrdenReembolsoRow {
  id: string;
  pago_id: string;
  monto: string;
  motivo: string;
  estatus: string;
  ticket_id: string | null;
  referencia_pasarela: string | null;
  created_at: string;
}

export interface OrdenTicketRow {
  id: string;
  asunto: string;
  categoria: string;
  estatus: string;
  prioridad: string;
  tipo: string;
  tier_actual: string;
  created_at: string;
}

export interface OrdenEvidenciaRow {
  id: string;
  url_foto: string;
  fase: string;
  created_at: string;
}

export interface OrdenWebhookRow {
  external_id: string;
  event_type: string;
  processed_at: string | null;
  error: string | null;
  retry_count: number;
  created_at: string;
}

export interface OrdenDetalle {
  header: OrdenDetailHeader;
  pagos: OrdenPagoRow[];
  reembolsos: OrdenReembolsoRow[];
  tickets: OrdenTicketRow[];
  evidencias: OrdenEvidenciaRow[];
  webhook_events: OrdenWebhookRow[];
}

export async function getOrdenDetalle(id: string): Promise<OrdenDetalle | null> {
  const header = await queryOne<OrdenDetailHeader>(
    `SELECT
       o.id,
       o.estatus,
       o.fecha_programada,
       o.created_at,
       o.monto_total::text AS monto_total,
       COALESCE(o.descuento, 0)::text AS descuento,
       o.pin_cliente,
       o.pin_prestador,
       o.notas_cliente,
       s.id AS servicio_id,
       s.nombre AS servicio_nombre,
       cat.nombre AS servicio_categoria,
       c.id AS cliente_id,
       (c.nombre || ' ' || c.apellidos) AS cliente_nombre,
       c.email AS cliente_email,
       c.telefono AS cliente_telefono,
       p.id AS prestador_id,
       (CASE WHEN p.id IS NULL THEN NULL ELSE p.nombre || ' ' || p.apellidos END) AS prestador_nombre,
       p.telefono AS prestador_telefono,
       (d.calle || ' ' || d.numero_ext ||
         COALESCE(' int. ' || d.numero_int, '') ||
         ', ' || d.colonia || ', ' || d.ciudad || ', ' || d.estado || ' ' || d.cp) AS direccion_completa,
       d.referencia AS direccion_referencia,
       cup.codigo AS cupon_codigo
     FROM ordenes_servicio o
     JOIN servicios s ON s.id = o.servicio_id
     LEFT JOIN categorias_servicio cat ON cat.id = s.categoria_id
     JOIN usuarios c ON c.id = o.cliente_id
     LEFT JOIN usuarios p ON p.id = o.prestador_id
     JOIN direcciones d ON d.id = o.direccion_id
     LEFT JOIN cupones cup ON cup.id = o.cupon_id
     WHERE o.id = $1`,
    [id],
  );
  if (!header) return null;

  const [pagos, reembolsos, tickets, evidencias] = await Promise.all([
    query<OrdenPagoRow>(
      `SELECT id, monto::text AS monto, metodo::text AS metodo, estatus::text AS estatus,
              raw_status, payment_intent_id, customer_id_pasarela, referencia_pasarela,
              webhook_received_at, created_at
         FROM pagos WHERE orden_id = $1 ORDER BY created_at DESC`,
      [id],
    ),
    query<OrdenReembolsoRow>(
      `SELECT r.id, r.pago_id, r.monto::text AS monto, r.motivo,
              r.estatus::text AS estatus, r.ticket_id, r.referencia_pasarela, r.created_at
         FROM reembolsos r
         JOIN pagos p ON p.id = r.pago_id
         WHERE p.orden_id = $1
         ORDER BY r.created_at DESC`,
      [id],
    ),
    query<OrdenTicketRow>(
      `SELECT id, asunto, categoria::text AS categoria, estatus::text AS estatus,
              prioridad::text AS prioridad, tipo::text AS tipo, tier_actual::text AS tier_actual,
              created_at
         FROM tickets_soporte WHERE orden_id = $1 ORDER BY created_at DESC`,
      [id],
    ),
    query<OrdenEvidenciaRow>(
      `SELECT id, url_foto, fase, created_at
         FROM evidencias_orden WHERE orden_id = $1 ORDER BY created_at ASC`,
      [id],
    ),
  ]);

  const intentIds = pagos
    .map((p) => p.payment_intent_id)
    .filter((v): v is string => Boolean(v));

  let webhook_events: OrdenWebhookRow[] = [];
  if (intentIds.length > 0) {
    webhook_events = await query<OrdenWebhookRow>(
      `SELECT external_id, event_type, processed_at, error, retry_count, created_at
         FROM webhook_events
        WHERE proveedor = 'stripe'
          AND payload::text ~ ANY($1::text[])
        ORDER BY created_at DESC
        LIMIT 50`,
      [intentIds],
    );
  }

  return { header, pagos, reembolsos, tickets, evidencias, webhook_events };
}
