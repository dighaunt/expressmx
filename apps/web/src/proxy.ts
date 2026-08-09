import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secretValue = process.env.JWT_SECRET;
if (!secretValue || secretValue.length < 32) {
  throw new Error('JWT_SECRET environment variable is required (min 32 chars)');
}
const SECRET = new TextEncoder().encode(secretValue);

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/v1/auth/login',
  '/api/v1/auth/logout',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/mobile/register',
  '/api/v1/mobile/verify-email',
  '/api/v1/mobile/resend-verification',
  '/api/v1/mobile/services',
  '/api/v1/mobile/invitations/validate',
  '/api/v1/webhooks/stripe',
  '/api/mobile/register',
  '/api/mobile/services',
];

const DASHBOARD_PATHS = ['/dashboard'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function unauthorizedJson(code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status: 401 });
}

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const isDashboard = DASHBOARD_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isProtectedApi = pathname.startsWith('/api/');

  if (!isDashboard && !isProtectedApi) return NextResponse.next();

  const authHeader = req.headers.get('authorization') ?? '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieToken = req.cookies.get('auth_token')?.value;
  const token = bearer ?? cookieToken;

  if (!token) {
    if (isProtectedApi) return unauthorizedJson('UNAUTHORIZED', 'No autenticado');
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const headers = new Headers(req.headers);
    headers.set('x-session-sub', String(payload.sub ?? ''));
    headers.set('x-session-rol', String((payload as { rol?: string }).rol ?? ''));
    headers.set('x-pathname', pathname);
    return NextResponse.next({ request: { headers } });
  } catch {
    if (isProtectedApi) return unauthorizedJson('INVALID_TOKEN', 'Token inválido o expirado');
    const response = NextResponse.redirect(new URL('/login', req.url));
    response.cookies.delete('auth_token');
    return response;
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
