import Stripe from 'stripe';
import { InternalError } from '@/lib/errors/http-errors';

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !key.startsWith('sk_')) {
    throw new InternalError('STRIPE_SECRET_KEY no esta configurada');
  }
  cached = new Stripe(key, {
    apiVersion: '2026-04-22.dahlia',
    typescript: true,
    appInfo: { name: 'ExpressMX', version: '1.0.0' },
  });
  return cached;
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !secret.startsWith('whsec_')) {
    throw new InternalError('STRIPE_WEBHOOK_SECRET no esta configurada');
  }
  return secret;
}
