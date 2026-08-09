import { NextResponse } from 'next/server';
import { query, queryOne } from '@expressmx/database';
import { defineEndpoint } from '@/lib/api/handler';

interface SaldoRow {
  saldo_mxn: string | number;
}

interface MovimientoRow {
  id: string;
  tipo: string;
  monto_mxn: string | number;
  motivo_md: string;
  ticket_id: string | null;
  orden_id: string | null;
  created_at: string;
}

interface ReembolsoRow {
  id: string;
  monto: string | number;
  motivo: string;
  estatus: string;
  created_at: string;
  referencia_pasarela: string | null;
  payment_intent_id: string | null;
  ticket_id: string | null;
  ticket_asunto: string | null;
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n : 0;
}

export const GET = defineEndpoint({
  tag: 'GET /api/v1/mobile/wallet',
  auth: 'session',
  handler: async ({ session }) => {
    const clienteId = session!.sub;

    const saldoRow = await queryOne<SaldoRow>(
      `SELECT saldo_mxn FROM v_saldo_cliente WHERE cliente_id = $1`,
      [clienteId],
    );

    const movimientosRows = await query<MovimientoRow>(
      `SELECT id, tipo::text, monto_mxn, motivo_md, ticket_id, orden_id, created_at
         FROM saldo_cliente_movimientos
        WHERE cliente_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [clienteId],
    );

    const reembolsosRows = await query<ReembolsoRow>(
      `SELECT r.id, r.monto, r.motivo, r.estatus::text, r.created_at, r.referencia_pasarela,
              p.payment_intent_id, t.id AS ticket_id, t.asunto AS ticket_asunto
         FROM reembolsos r
         JOIN pagos p ON p.id = r.pago_id
         JOIN ordenes_servicio o ON o.id = p.orden_id
         LEFT JOIN tickets_soporte t ON t.id = r.ticket_id
        WHERE o.cliente_id = $1
        ORDER BY r.created_at DESC
        LIMIT 50`,
      [clienteId],
    );

    return NextResponse.json({
      data: {
        saldo: toNumber(saldoRow?.saldo_mxn),
        movimientos: movimientosRows.map((m) => ({
          id: m.id,
          tipo: m.tipo,
          monto_mxn: toNumber(m.monto_mxn),
          motivo_md: m.motivo_md,
          ticket_id: m.ticket_id,
          orden_id: m.orden_id,
          created_at: m.created_at,
        })),
        reembolsos: reembolsosRows.map((r) => ({
          id: r.id,
          monto: toNumber(r.monto),
          motivo: r.motivo,
          estatus: r.estatus,
          created_at: r.created_at,
          referencia_pasarela: r.referencia_pasarela,
          payment_intent_id: r.payment_intent_id,
          ticket_id: r.ticket_id,
          ticket_asunto: r.ticket_asunto,
        })),
      },
    });
  },
});
