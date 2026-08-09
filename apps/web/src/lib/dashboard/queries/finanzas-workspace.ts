import 'server-only';
import { query, queryOne } from '@expressmx/database';
import type { EstatusCorte, EstatusFactura } from '@/lib/dashboard/finanzas-shared';
import type { EstatusReembolso } from '@/lib/dashboard/queries/reembolsos';

export interface FinanzasQueueCounts {
  reembolsos_pendientes: number;
  reembolsos_por_procesar: number;
  reembolsos_recientes: number;
  cortes_por_revisar: number;
  cortes_por_depositar: number;
  facturas_hoy: number;
  mias: number;
  pagos_sin_reconciliar: number;
  pagos_fallidos_24h: number;
  tareas_finanzas: number;
}

export async function getFinanzasQueueCounts(
  viewerId: string,
): Promise<FinanzasQueueCounts> {
  const row = await queryOne<FinanzasQueueCounts>(
    `SELECT
       (SELECT COUNT(*) FROM reembolsos WHERE estatus = 'solicitado')::INT AS reembolsos_pendientes,
       (SELECT COUNT(*) FROM reembolsos WHERE estatus = 'aprobado')::INT AS reembolsos_por_procesar,
       (SELECT COUNT(*) FROM reembolsos
        WHERE estatus = 'procesado'
          AND created_at >= NOW() - INTERVAL '14 days')::INT AS reembolsos_recientes,
       (SELECT COUNT(*) FROM cortes_pago WHERE estatus = 'generado')::INT AS cortes_por_revisar,
       (SELECT COUNT(*) FROM cortes_pago WHERE estatus = 'revisado')::INT AS cortes_por_depositar,
       (SELECT COUNT(*) FROM facturas
        WHERE DATE(created_at) = CURRENT_DATE)::INT AS facturas_hoy,
       (SELECT COUNT(*) FROM reembolsos
        WHERE aprobado_por = $1 AND estatus IN ('aprobado', 'rechazado'))::INT AS mias,
       (SELECT COUNT(*) FROM pagos
         WHERE estatus = 'pendiente'
           AND payment_intent_id IS NOT NULL
           AND webhook_received_at IS NULL
           AND created_at < NOW() - INTERVAL '5 minutes')::INT AS pagos_sin_reconciliar,
       (SELECT COUNT(*) FROM pagos
         WHERE estatus = 'fallido'
           AND created_at >= NOW() - INTERVAL '24 hours')::INT AS pagos_fallidos_24h,
       (SELECT COUNT(*) FROM tareas_caso
         WHERE grupo_asignado IN ('finanzas_l1','finanzas_l2')
           AND estado IN ('abierta','en_progreso'))::INT AS tareas_finanzas`,
    [viewerId],
  );
  return (
    row ?? {
      reembolsos_pendientes: 0,
      reembolsos_por_procesar: 0,
      reembolsos_recientes: 0,
      cortes_por_revisar: 0,
      cortes_por_depositar: 0,
      facturas_hoy: 0,
      mias: 0,
      pagos_sin_reconciliar: 0,
      pagos_fallidos_24h: 0,
      tareas_finanzas: 0,
    }
  );
}

export interface PagoAnomaloRow {
  pago_id: string;
  orden_id: string;
  cliente_nombre: string;
  monto: string;
  estatus: string;
  payment_intent_id: string | null;
  raw_status: string | null;
  webhook_received_at: string | null;
  minutos_sin_webhook: number;
  created_at: string;
}

export async function listarPagosAnomalos(limit = 30): Promise<PagoAnomaloRow[]> {
  return await query<PagoAnomaloRow>(
    `SELECT
       p.id AS pago_id,
       p.orden_id,
       (c.nombre || ' ' || c.apellidos) AS cliente_nombre,
       p.monto::text AS monto,
       p.estatus::text AS estatus,
       p.payment_intent_id,
       p.raw_status,
       p.webhook_received_at,
       FLOOR(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 60)::INT AS minutos_sin_webhook,
       p.created_at
     FROM pagos p
     JOIN ordenes_servicio o ON o.id = p.orden_id
     JOIN usuarios c ON c.id = o.cliente_id
     WHERE p.estatus = 'pendiente'
       AND p.payment_intent_id IS NOT NULL
       AND p.webhook_received_at IS NULL
       AND p.created_at < NOW() - INTERVAL '5 minutes'
     ORDER BY p.created_at ASC
     LIMIT $1`,
    [limit],
  );
}

export type FinanzasItemKind = 'reembolso' | 'corte' | 'factura';

export interface FinanzasQueueItem {
  kind: FinanzasItemKind;
  id: string;
  primary: string;
  secondary: string;
  meta: string;
  monto: string;
  estatus: string;
  ts: string;
}

export type FinanzasBucket =
  | 'reembolsos_pendientes'
  | 'reembolsos_por_procesar'
  | 'reembolsos_recientes'
  | 'cortes_por_revisar'
  | 'cortes_por_depositar'
  | 'facturas'
  | 'mias';

interface ReembolsoQueueRow {
  id: string;
  monto: string;
  estatus: EstatusReembolso;
  motivo: string;
  cliente_nombre: string;
  servicio_nombre: string;
  created_at: string;
  aprobado_por: string | null;
}

interface CorteQueueRow {
  id: string;
  prestador_nombre: string;
  fecha_corte: string;
  monto_total: string;
  estatus: EstatusCorte;
  num_transacciones: number;
  created_at: string;
}

interface FacturaQueueRow {
  id: string;
  rfc_receptor: string;
  total: string;
  estatus: EstatusFactura;
  uuid_cfdi: string | null;
  created_at: string;
}

export async function listarColaFinanzas(
  viewerId: string,
  bucket: FinanzasBucket,
  limit = 30,
): Promise<FinanzasQueueItem[]> {
  if (
    bucket === 'reembolsos_pendientes' ||
    bucket === 'reembolsos_por_procesar' ||
    bucket === 'reembolsos_recientes'
  ) {
    const estatus =
      bucket === 'reembolsos_pendientes'
        ? 'solicitado'
        : bucket === 'reembolsos_por_procesar'
          ? 'aprobado'
          : 'procesado';
    const rows = await query<ReembolsoQueueRow>(
      `SELECT
         r.id,
         r.monto::text AS monto,
         r.estatus::text AS estatus,
         r.motivo,
         (c.nombre || ' ' || c.apellidos) AS cliente_nombre,
         s.nombre AS servicio_nombre,
         r.created_at,
         r.aprobado_por
       FROM reembolsos r
       JOIN pagos p ON p.id = r.pago_id
       JOIN ordenes_servicio o ON o.id = p.orden_id
       JOIN servicios s ON s.id = o.servicio_id
       JOIN usuarios c ON c.id = o.cliente_id
       WHERE r.estatus = $1::estatus_reembolso
         AND ($1::estatus_reembolso <> 'procesado' OR r.created_at >= NOW() - INTERVAL '14 days')
       ORDER BY
         CASE WHEN $1::estatus_reembolso = 'procesado' THEN r.created_at END DESC,
         CASE WHEN $1::estatus_reembolso <> 'procesado' THEN r.created_at END ASC
       LIMIT $2`,
      [estatus, limit],
    );
    return rows.map((r) => ({
      kind: 'reembolso',
      id: r.id,
      primary: r.cliente_nombre,
      secondary: r.servicio_nombre,
      meta: r.motivo.length > 60 ? `${r.motivo.slice(0, 60)}…` : r.motivo,
      monto: r.monto,
      estatus: r.estatus,
      ts: r.created_at,
    }));
  }

  if (bucket === 'cortes_por_revisar' || bucket === 'cortes_por_depositar') {
    const estatus = bucket === 'cortes_por_revisar' ? 'generado' : 'revisado';
    const rows = await query<CorteQueueRow>(
      `SELECT
         c.id,
         u.nombre || ' ' || u.apellidos AS prestador_nombre,
         to_char(c.fecha_corte, 'YYYY-MM-DD') AS fecha_corte,
         c.monto_total::text AS monto_total,
         c.estatus::text AS estatus,
         c.num_transacciones,
         c.created_at
       FROM cortes_pago c
       JOIN usuarios u ON u.id = c.prestador_id
       WHERE c.estatus = $1::estatus_corte
       ORDER BY c.fecha_corte DESC, c.created_at DESC
       LIMIT $2`,
      [estatus, limit],
    );
    return rows.map((r) => ({
      kind: 'corte',
      id: r.id,
      primary: r.prestador_nombre,
      secondary: `Corte ${r.fecha_corte}`,
      meta: `${r.num_transacciones} transacciones`,
      monto: r.monto_total,
      estatus: r.estatus,
      ts: r.created_at,
    }));
  }

  if (bucket === 'facturas') {
    const rows = await query<FacturaQueueRow>(
      `SELECT
         f.id,
         f.rfc_receptor,
         f.total::text AS total,
         f.estatus::text AS estatus,
         f.uuid_cfdi,
         f.created_at
       FROM facturas f
       ORDER BY f.created_at DESC
       LIMIT $1`,
      [limit],
    );
    return rows.map((r) => ({
      kind: 'factura',
      id: r.id,
      primary: r.rfc_receptor,
      secondary: r.uuid_cfdi ? `${r.uuid_cfdi.slice(0, 13)}…` : 'Sin UUID',
      meta: '',
      monto: r.total,
      estatus: r.estatus,
      ts: r.created_at,
    }));
  }

  const rows = await query<ReembolsoQueueRow>(
    `SELECT
       r.id,
       r.monto::text AS monto,
       r.estatus::text AS estatus,
       r.motivo,
       (c.nombre || ' ' || c.apellidos) AS cliente_nombre,
       s.nombre AS servicio_nombre,
       r.created_at,
       r.aprobado_por
     FROM reembolsos r
     JOIN pagos p ON p.id = r.pago_id
     JOIN ordenes_servicio o ON o.id = p.orden_id
     JOIN servicios s ON s.id = o.servicio_id
     JOIN usuarios c ON c.id = o.cliente_id
     WHERE r.aprobado_por = $1
     ORDER BY r.created_at DESC
     LIMIT $2`,
    [viewerId, limit],
  );
  return rows.map((r) => ({
    kind: 'reembolso',
    id: r.id,
    primary: r.cliente_nombre,
    secondary: r.servicio_nombre,
    meta: r.motivo.length > 60 ? `${r.motivo.slice(0, 60)}…` : r.motivo,
    monto: r.monto,
    estatus: r.estatus,
    ts: r.created_at,
  }));
}
