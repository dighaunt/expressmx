import type Stripe from 'stripe';
import { query, queryOne } from '@expressmx/database';
import { getStripe, getWebhookSecret } from './stripe';
import { mapStripeStatus, mapPaymentMethodToMetodo, describePaymentMethod } from './mappers';
import { BadRequestError } from '@/lib/errors/http-errors';

export async function verifyAndConstructEvent(
  rawBody: string,
  signature: string | null,
): Promise<Stripe.Event> {
  if (!signature) throw new BadRequestError('Falta header stripe-signature');
  const stripe = getStripe();
  try {
    return stripe.webhooks.constructEvent(rawBody, signature, getWebhookSecret());
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'firma invalida';
    throw new BadRequestError(`Webhook signature invalido: ${msg}`);
  }
}

export interface WebhookProcessResult {
  status: 'processed' | 'duplicate' | 'unhandled' | 'error';
  message?: string;
}

export async function recordAndDispatchEvent(
  event: Stripe.Event,
): Promise<WebhookProcessResult> {
  const inserted = await queryOne<{ id: string; xmax: string }>(
    `INSERT INTO webhook_events (proveedor, external_id, event_type, payload)
     VALUES ('stripe', $1, $2, $3::jsonb)
     ON CONFLICT (proveedor, external_id) DO NOTHING
     RETURNING id, xmax::text AS xmax`,
    [event.id, event.type, JSON.stringify(event)],
  );

  if (!inserted) {
    return { status: 'duplicate', message: `${event.id} ya procesado` };
  }

  try {
    const handled = await dispatch(event);
    await query(
      'UPDATE webhook_events SET processed_at = NOW() WHERE id = $1',
      [inserted.id],
    );
    return handled;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'error desconocido';
    await query(
      `UPDATE webhook_events
          SET error = $1, retry_count = retry_count + 1
        WHERE id = $2`,
      [msg, inserted.id],
    );
    return { status: 'error', message: msg };
  }
}

async function dispatch(event: Stripe.Event): Promise<WebhookProcessResult> {
  switch (event.type) {
    case 'payment_intent.succeeded':
      return handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
    case 'payment_intent.payment_failed':
      return handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
    case 'payment_intent.canceled':
      return handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
    case 'charge.refunded':
      return handleChargeRefunded(event.data.object as Stripe.Charge);
    default:
      return { status: 'unhandled', message: event.type };
  }
}

async function handlePaymentIntentSucceeded(
  intent: Stripe.PaymentIntent,
): Promise<WebhookProcessResult> {
  const stripe = getStripe();
  let pmDescription: string | null = null;
  let metodo: 'tarjeta' | 'efectivo' | 'transferencia' = 'tarjeta';

  if (intent.payment_method) {
    const pmId =
      typeof intent.payment_method === 'string'
        ? intent.payment_method
        : intent.payment_method.id;
    try {
      const pm = await stripe.paymentMethods.retrieve(pmId);
      metodo = mapPaymentMethodToMetodo(pm);
      pmDescription = describePaymentMethod(pm);
    } catch {}
  }

  await query(
    `UPDATE pagos
        SET estatus = $1::estatus_pago,
            metodo = $2::metodo_pago,
            raw_status = $3,
            referencia_pasarela = COALESCE($4, referencia_pasarela),
            webhook_received_at = NOW()
      WHERE payment_intent_id = $5`,
    [mapStripeStatus(intent.status), metodo, intent.status, pmDescription, intent.id],
  );

  return {
    status: 'processed',
    message: `pago ${intent.id} procesado`,
  };
}

async function handlePaymentIntentFailed(
  intent: Stripe.PaymentIntent,
): Promise<WebhookProcessResult> {
  await query(
    `UPDATE pagos
        SET estatus = 'fallido'::estatus_pago,
            raw_status = $1,
            webhook_received_at = NOW()
      WHERE payment_intent_id = $2`,
    [intent.status, intent.id],
  );
  return { status: 'processed', message: `pago ${intent.id} marcado fallido` };
}

async function handlePaymentIntentCanceled(
  intent: Stripe.PaymentIntent,
): Promise<WebhookProcessResult> {
  await query(
    `UPDATE pagos
        SET estatus = 'fallido'::estatus_pago,
            raw_status = $1,
            webhook_received_at = NOW()
      WHERE payment_intent_id = $2`,
    [intent.status, intent.id],
  );
  return { status: 'processed', message: `pago ${intent.id} cancelado` };
}

async function handleChargeRefunded(charge: Stripe.Charge): Promise<WebhookProcessResult> {
  if (!charge.payment_intent) {
    return { status: 'unhandled', message: 'charge sin payment_intent' };
  }
  const intentId =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent.id;

  const refundId = charge.refunds?.data?.[0]?.id ?? null;

  await query(
    `UPDATE pagos
        SET estatus = 'reembolsado'::estatus_pago,
            webhook_received_at = NOW()
      WHERE payment_intent_id = $1`,
    [intentId],
  );

  await query(
    `UPDATE reembolsos
        SET estatus = 'procesado'::estatus_reembolso,
            referencia_pasarela = COALESCE(referencia_pasarela, $1)
      WHERE pago_id = (SELECT id FROM pagos WHERE payment_intent_id = $2)
        AND estatus = 'aprobado'`,
    [refundId, intentId],
  );

  return { status: 'processed', message: `pago ${intentId} reembolsado` };
}
