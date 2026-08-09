import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { requireSession } from '@/lib/auth/session';
import { ServiceUnavailableError } from '@/lib/errors/http-errors';
import { createRealtimeJwt } from '@/lib/realtime/ably';

export const GET = withApiHandler(async (req) => {
  const session = await requireSession(req);
  const token = await createRealtimeJwt({
    userId: session.sub,
    role: session.rol,
  });

  if (!token) throw new ServiceUnavailableError('Realtime no está configurado');

  return new NextResponse(token, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}, 'GET /api/realtime/token');
