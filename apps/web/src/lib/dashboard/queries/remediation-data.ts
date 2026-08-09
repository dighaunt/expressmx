import 'server-only';
import { query, queryOne } from '@expressmx/database';

export interface PagoElegible {
  id: string;
  orden_id: string;
  monto: string;
  metodo: string;
  estatus: string;
  created_at: string;
}

export async function listarPagosDelCliente(
  clienteId: string,
  limit: number = 10,
): Promise<PagoElegible[]> {
  return await query<PagoElegible>(
    `SELECT
       p.id, p.orden_id, p.monto::text AS monto,
       p.metodo::text AS metodo, p.estatus::text AS estatus,
       p.created_at
     FROM pagos p
     JOIN ordenes_servicio o ON o.id = p.orden_id
     WHERE o.cliente_id = $1
     ORDER BY p.created_at DESC
     LIMIT $2`,
    [clienteId, limit],
  );
}

export interface FacturaElegible {
  id: string;
  uuid_cfdi: string | null;
  estatus: string;
  total: string;
  orden_id: string | null;
  created_at: string;
}

export async function listarFacturasDelCliente(
  clienteId: string,
  limit: number = 10,
): Promise<FacturaElegible[]> {
  return await query<FacturaElegible>(
    `SELECT
       f.id, f.uuid_cfdi, f.estatus::text AS estatus,
       f.total::text AS total, f.orden_id, f.created_at
     FROM facturas f
     JOIN ordenes_servicio o ON o.id = f.orden_id
     WHERE o.cliente_id = $1
     ORDER BY f.created_at DESC
     LIMIT $2`,
    [clienteId, limit],
  );
}

export interface UmbralesRemediation {
  reembolso_express_max_mxn: number;
  credito_express_max_mxn: number;
  suspension_express_max_dias: number;
}

export async function getUmbralesRemediation(): Promise<UmbralesRemediation> {
  const rows = await query<{ clave: string; valor: string }>(
    `SELECT clave, valor FROM config_sistema
      WHERE clave IN (
        'reembolso_express_max_mxn',
        'credito_express_max_mxn',
        'suspension_express_max_dias'
      )`,
  );
  const map = new Map(rows.map((r) => [r.clave, Number(r.valor)]));
  return {
    reembolso_express_max_mxn: Number.isFinite(map.get('reembolso_express_max_mxn'))
      ? (map.get('reembolso_express_max_mxn') as number)
      : 500,
    credito_express_max_mxn: Number.isFinite(map.get('credito_express_max_mxn'))
      ? (map.get('credito_express_max_mxn') as number)
      : 300,
    suspension_express_max_dias: Number.isFinite(map.get('suspension_express_max_dias'))
      ? (map.get('suspension_express_max_dias') as number)
      : 7,
  };
}

export interface CapCreditoServicio {
  capServicioMxn: number | null;
  factorServicio: number | null;
  montoOrden: number | null;
  aplicadoPrevio: number;
}

export async function getCapCreditoServicio(
  ticketId: string,
  ordenId: string | null,
): Promise<CapCreditoServicio> {
  if (!ordenId) {
    return {
      capServicioMxn: null,
      factorServicio: null,
      montoOrden: null,
      aplicadoPrevio: 0,
    };
  }

  const [factorRow, ordenRow, previoRow] = await Promise.all([
    queryOne<{ valor: string }>(
      `SELECT valor FROM config_sistema WHERE clave = 'credito_factor_max_servicio'`,
    ),
    queryOne<{ monto_total: string }>(
      `SELECT monto_total::text AS monto_total FROM ordenes_servicio WHERE id = $1`,
      [ordenId],
    ),
    queryOne<{ total: string | null }>(
      `SELECT COALESCE(SUM(monto_mxn), 0)::text AS total
         FROM saldo_cliente_movimientos
        WHERE ticket_id = $1
          AND tipo IN ('credito_manual','credito_compensacion')`,
      [ticketId],
    ),
  ]);

  const factorParsed = factorRow ? Number(factorRow.valor) : 1.0;
  const factorServicio =
    Number.isFinite(factorParsed) && factorParsed > 0 ? factorParsed : 1.0;

  if (!ordenRow) {
    return {
      capServicioMxn: null,
      factorServicio,
      montoOrden: null,
      aplicadoPrevio: previoRow ? Number(previoRow.total) : 0,
    };
  }

  const montoOrden = Number(ordenRow.monto_total);
  const aplicadoPrevio = previoRow ? Number(previoRow.total) : 0;
  const capTotal = Number.isFinite(montoOrden) ? montoOrden * factorServicio : null;
  const capRestante =
    capTotal !== null ? Math.max(0, capTotal - aplicadoPrevio) : null;

  return {
    capServicioMxn: capRestante,
    factorServicio,
    montoOrden: Number.isFinite(montoOrden) ? montoOrden : null,
    aplicadoPrevio,
  };
}
