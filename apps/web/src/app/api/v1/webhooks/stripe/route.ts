import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { recordAndDispatchEvent, verifyAndConstructEvent } from '@/lib/payments/webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');
  const event = await verifyAndConstructEvent(rawBody, signature);
  const result = await recordAndDispatchEvent(event);
  return NextResponse.json({ received: true, ...result });
}

export const POST = withApiHandler(handler, 'POST /api/v1/webhooks/stripe');
