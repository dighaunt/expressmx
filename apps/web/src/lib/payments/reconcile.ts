import type Stripe from 'stripe';
import { queryOne } from '@expressmx/database';
import { getStripe } from './stripe';
import { recordAndDispatchEvent } from './webhook';

export type ReconcileSource = 'cron' | 'manual' | 'webhook';

export interface ReconcileResult {
  status: 'processed' | 'duplicate' | 'no_intent' | 'unhandled' | 'error';
  pagoId: string;
  paymentIntentId: string | null;
  stripeStatus?: string;
  message?: string;
}

interface PagoRow {
  id: string;
  payment_intent_id: string | null;
  estatus: string;
  webhook_received_at: string | null;
}

const SYNTHETIC_TYPE: Record<Stripe.PaymentIntent.Status, Stripe.Event['type'] | null> = {
  requires_payment_method: null,
  requires_confirmation: null,
  requires_action: null,
  processing: null,
  requires_capture: null,
  succeeded: 'payment_intent.succeeded',
  canceled: 'payment_intent.canceled',
};

export async function reconcilePayment(
  pagoId: string,
  source: ReconcileSource,
): Promise<ReconcileResult> {
  const pago = await queryOne<PagoRow>(
    `SELECT id, payment_intent_id, estatus::text AS estatus, webhook_received_at
       FROM pagos WHERE id = $1`,
    [pagoId],
  );
  if (!pago) {
    return {
      status: 'error',
      pagoId,
      paymentIntentId: null,
      message: 'Pago no encontrado',
    };
  }
  if (!pago.payment_intent_id) {
    return {
      status: 'no_intent',
      pagoId,
      paymentIntentId: null,
      message: 'El pago no tiene payment_intent_id; no es de Stripe',
    };
  }

  const stripe = getStripe();
  const intent = await stripe.paymentIntents.retrieve(pago.payment_intent_id);

  const eventType = SYNTHETIC_TYPE[intent.status];
  if (!eventType) {
    return {
      status: 'unhandled',
      pagoId,
      paymentIntentId: pago.payment_intent_id,
      stripeStatus: intent.status,
      message: `Stripe reporta '${intent.status}', aún no es resolutivo`,
    };
  }

  const externalId = `recon_${pago.payment_intent_id}_${Math.floor(Date.now() / 1000)}`;
  const syntheticEvent = {
    id: externalId,
    object: 'event',
    api_version: null,
    created: Math.floor(Date.now() / 1000),
    type: eventType,
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: { object: intent },
  } as unknown as Stripe.Event;

  const result = await recordAndDispatchEvent(syntheticEvent);

  return {
    status: result.status === 'processed' ? 'processed' : result.status,
    pagoId,
    paymentIntentId: pago.payment_intent_id,
    stripeStatus: intent.status,
    message: result.message ?? `reconciliado vía ${source}`,
  };
}

export async function markPaymentManuallyFailed(
  pagoId: string,
  notas: string,
): Promise<{ ok: boolean; message?: string }> {
  const updated = await queryOne<{ id: string }>(
    `UPDATE pagos
        SET estatus = 'fallido'::estatus_pago,
            raw_status = 'manual_marked_failed',
            webhook_received_at = COALESCE(webhook_received_at, NOW())
      WHERE id = $1
      RETURNING id`,
    [pagoId],
  );
  if (!updated) {
    return { ok: false, message: 'Pago no encontrado' };
  }
  void notas;
  return { ok: true };
}
