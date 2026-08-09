import { NextResponse } from 'next/server';
import { defineEndpoint } from '@/lib/api/handler';
import { createRealtimeJwt } from '@/lib/realtime/ably';
import { ServiceUnavailableError } from '@/lib/errors/http-errors';

export const GET = defineEndpoint({
  tag: 'GET /api/v1/mobile/realtime/token',
  auth: 'session',
  handler: async ({ session }) => {
    const token = await createRealtimeJwt({
      userId: session!.sub,
      role: session!.rol,
    });

    if (!token) throw new ServiceUnavailableError('Realtime no está configurado');

    return new NextResponse(token, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  },
});
