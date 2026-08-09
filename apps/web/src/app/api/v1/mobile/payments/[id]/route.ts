import { NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { mobilePagoIdParamsSchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import { NotFoundError } from '@/lib/errors/http-errors';

interface PagoRow {
  id: string;
  orden_id: string;
  monto: string;
  metodo: string;
  estatus: string;
  referencia_pasarela: string | null;
  payment_intent_id: string | null;
  raw_status: string | null;
  webhook_received_at: string | null;
  created_at: string;
  cliente_id: string;
}

export const GET = defineEndpoint({
  tag: 'GET /api/v1/mobile/payments/[id]',
  auth: 'session',
  paramsSchema: mobilePagoIdParamsSchema,
  handler: async ({ params, session }) => {
    const row = await queryOne<PagoRow>(
      `SELECT
         p.id,
         p.orden_id,
         p.monto::text AS monto,
         p.metodo::text AS metodo,
         p.estatus::text AS estatus,
         p.referencia_pasarela,
         p.payment_intent_id,
         p.raw_status,
         p.webhook_received_at,
         p.created_at,
         o.cliente_id
       FROM pagos p
       JOIN ordenes_servicio o ON o.id = p.orden_id
       WHERE p.id = $1`,
      [params.id],
    );
    if (!row || row.cliente_id !== session!.sub) {
      throw new NotFoundError('Pago no encontrado');
    }
    return NextResponse.json({
      data: {
        id: row.id,
        orden_id: row.orden_id,
        monto: row.monto,
        metodo: row.metodo,
        estatus: row.estatus,
        referencia_pasarela: row.referencia_pasarela,
        payment_intent_id: row.payment_intent_id,
        raw_status: row.raw_status,
        webhook_received_at: row.webhook_received_at,
        created_at: row.created_at,
      },
    });
  },
});
