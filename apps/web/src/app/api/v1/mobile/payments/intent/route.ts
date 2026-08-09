import { NextResponse } from 'next/server';
import { mobilePaymentIntentSchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import { createPaymentIntentForOrder } from '@/lib/payments/intent';

export const POST = defineEndpoint({
  tag: 'POST /api/v1/mobile/payments/intent',
  auth: 'session',
  bodySchema: mobilePaymentIntentSchema,
  handler: async ({ body, session }) => {
    const result = await createPaymentIntentForOrder({
      orden_id: body.orden_id,
      cliente_id: session!.sub,
    });
    return NextResponse.json({
      data: {
        pago_id: result.pago_id,
        payment_intent_id: result.payment_intent_id,
        client_secret: result.client_secret,
        amount_centavos: result.amount_centavos,
        currency: 'mxn',
        customer_id: result.customer_id,
        ephemeral_key: result.ephemeral_key,
        publishable_key: process.env.STRIPE_PUBLISHABLE_KEY,
      },
    });
  },
});
