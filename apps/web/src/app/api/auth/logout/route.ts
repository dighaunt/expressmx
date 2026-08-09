import { NextResponse } from 'next/server';
import { defineEndpoint } from '@/lib/api/handler';

export const POST = defineEndpoint({
  tag: 'POST /api/auth/logout',
  auth: 'public',
  handler: async () => {
    const response = NextResponse.json({ ok: true });
    response.cookies.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
    return response;
  },
});
