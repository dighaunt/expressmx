import 'server-only';
import { query, queryOne } from '@expressmx/database';

export type TipoMovimientoSaldo =
  | 'credito_manual'
  | 'credito_compensacion'
  | 'aplicacion_orden'
  | 'reverso'
  | 'ajuste_admin';

export interface SaldoMovimiento {
  id: string;
  cliente_id: string;
  tipo: TipoMovimientoSaldo;
  monto_mxn: string;
  motivo_md: string;
  ticket_id: string | null;
  orden_id: string | null;
  reverso_de: string | null;
  creado_por: string;
  creado_por_nombre: string;
  aprobacion_id: string | null;
  created_at: string;
}

export interface SaldoCliente {
  saldo_mxn: string;
  movimientos_total: number;
  ultimo_movimiento_at: string | null;
}

export async function getSaldoCliente(clienteId: string): Promise<SaldoCliente> {
  const row = await queryOne<SaldoCliente>(
    `SELECT
       saldo_mxn::text AS saldo_mxn,
       movimientos_total,
       ultimo_movimiento_at
     FROM v_saldo_cliente
     WHERE cliente_id = $1`,
    [clienteId],
  );
  return (
    row ?? {
      saldo_mxn: '0.00',
      movimientos_total: 0,
      ultimo_movimiento_at: null,
    }
  );
}

export async function listarMovimientos(
  clienteId: string,
  limit: number = 10,
): Promise<SaldoMovimiento[]> {
  return await query<SaldoMovimiento>(
    `SELECT
       m.id, m.cliente_id, m.tipo::text AS tipo,
       m.monto_mxn::text AS monto_mxn,
       m.motivo_md, m.ticket_id, m.orden_id, m.reverso_de,
       m.creado_por,
       u.nombre || ' ' || u.apellidos AS creado_por_nombre,
       m.aprobacion_id, m.created_at
     FROM saldo_cliente_movimientos m
     LEFT JOIN usuarios u ON u.id = m.creado_por
     WHERE m.cliente_id = $1
     ORDER BY m.created_at DESC
     LIMIT $2`,
    [clienteId, limit],
  );
}
