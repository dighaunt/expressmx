import type Stripe from 'stripe';

export type EstatusPago = 'pendiente' | 'procesado' | 'fallido' | 'reembolsado';
export type MetodoPago = 'tarjeta' | 'efectivo' | 'transferencia';

const STATUS_MAP: Record<Stripe.PaymentIntent.Status, EstatusPago> = {
  requires_payment_method: 'pendiente',
  requires_confirmation: 'pendiente',
  requires_action: 'pendiente',
  processing: 'pendiente',
  requires_capture: 'pendiente',
  succeeded: 'procesado',
  canceled: 'fallido',
};

export function mapStripeStatus(status: Stripe.PaymentIntent.Status): EstatusPago {
  return STATUS_MAP[status] ?? 'pendiente';
}

export function mapPaymentMethodToMetodo(
  pm: Stripe.PaymentMethod | string | null | undefined,
): MetodoPago {
  if (!pm || typeof pm === 'string') return 'tarjeta';
  switch (pm.type) {
    case 'card':
      return 'tarjeta';
    case 'oxxo':
    case 'customer_balance':
      return 'transferencia';
    default:
      return 'tarjeta';
  }
}

export function describePaymentMethod(pm: Stripe.PaymentMethod): string {
  if (pm.card) return `${pm.card.brand} ****${pm.card.last4}`;
  if (pm.oxxo) return 'OXXO';
  if (pm.customer_balance) return 'SPEI';
  return pm.type;
}
