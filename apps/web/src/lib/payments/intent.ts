import 'server-only';
import { query, queryOne } from '@expressmx/database';
import { getStripe } from './stripe';
import { ensureStripeCustomer } from './customer';
import { NotFoundError, ConflictError, UnprocessableError } from '@/lib/errors/http-errors';

interface OrdenRow {
  id: string;
  cliente_id: string;
  monto_total: string;
  estatus: string;
}

interface ExistingPagoRow {
  id: string;
  payment_intent_id: string | null;
  estatus: string;
}

export interface CreateIntentResult {
  pago_id: string;
  payment_intent_id: string;
  client_secret: string;
  amount_centavos: number;
  customer_id: string;
  ephemeral_key: string | null;
}

const PROHIBIDOS_NUEVO_PAGO = new Set(['cancelada', 'completada']);

export async function createPaymentIntentForOrder(params: {
  orden_id: string;
  cliente_id: string;
}): Promise<CreateIntentResult> {
  const orden = await queryOne<OrdenRow>(
    `SELECT id, cliente_id, monto_total::text AS monto_total, estatus::text AS estatus
       FROM ordenes_servicio
      WHERE id = $1`,
    [params.orden_id],
  );
  if (!orden) throw new NotFoundError('Orden no encontrada');
  if (orden.cliente_id !== params.cliente_id) {
    throw new NotFoundError('Orden no encontrada');
  }
  if (PROHIBIDOS_NUEVO_PAGO.has(orden.estatus)) {
    throw new UnprocessableError(`No se puede pagar una orden ${orden.estatus}`);
  }

  const existing = await queryOne<ExistingPagoRow>(
    `SELECT id, payment_intent_id, estatus::text AS estatus
       FROM pagos
      WHERE orden_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [params.orden_id],
  );

  if (existing?.estatus === 'procesado') {
    throw new ConflictError('Esta orden ya fue pagada');
  }

  const customerId = await ensureStripeCustomer(params.cliente_id);
  const amount = Math.round(Number(orden.monto_total) * 100);

  if (!Number.isFinite(amount) || amount < 100) {
    throw new UnprocessableError('Monto de la orden invalido');
  }

  const stripe = getStripe();

  if (existing?.payment_intent_id) {
    const intent = await stripe.paymentIntents.retrieve(existing.payment_intent_id);
    if (intent.status === 'succeeded') {
      throw new ConflictError('Esta orden ya fue pagada');
    }
    if (intent.status !== 'canceled' && intent.client_secret) {
      const ephemeralKey = await stripe.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: '2026-04-22.dahlia' as unknown as string },
      );
      return {
        pago_id: existing.id,
        payment_intent_id: intent.id,
        client_secret: intent.client_secret,
        amount_centavos: intent.amount,
        customer_id: customerId,
        ephemeral_key: ephemeralKey.secret ?? null,
      };
    }
  }

  const intent = await stripe.paymentIntents.create(
    {
      amount,
      currency: 'mxn',
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        orden_id: orden.id,
        cliente_id: orden.cliente_id,
        app: 'expressmx',
      },
    },
    { idempotencyKey: `orden-${orden.id}-${existing?.id ?? 'new'}` },
  );

  if (!intent.client_secret) {
    throw new UnprocessableError('Stripe no devolvio client_secret');
  }

  let pagoId: string;
  if (existing) {
    pagoId = existing.id;
    await query(
      `UPDATE pagos
          SET payment_intent_id = $1,
              customer_id_pasarela = $2,
              raw_status = $3,
              monto = $4
        WHERE id = $5`,
      [intent.id, customerId, intent.status, (amount / 100).toFixed(2), pagoId],
    );
  } else {
    const inserted = await queryOne<{ id: string }>(
      `INSERT INTO pagos
         (orden_id, monto, metodo, estatus, payment_intent_id, customer_id_pasarela, raw_status)
       VALUES ($1, $2, 'tarjeta', 'pendiente', $3, $4, $5)
       RETURNING id`,
      [orden.id, (amount / 100).toFixed(2), intent.id, customerId, intent.status],
    );
    pagoId = inserted!.id;
  }

  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: '2026-04-22.dahlia' as unknown as string },
  );

  return {
    pago_id: pagoId,
    payment_intent_id: intent.id,
    client_secret: intent.client_secret,
    amount_centavos: amount,
    customer_id: customerId,
    ephemeral_key: ephemeralKey.secret ?? null,
  };
}
