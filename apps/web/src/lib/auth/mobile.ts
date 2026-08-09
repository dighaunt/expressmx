import { NextResponse } from 'next/server';
import {
  getSession as getMobileSession,
  requireSession,
  requireRole,
  requireOwner,
  verifyToken,
} from './guards';
import type { SessionPayload } from './guards';

export { getMobileSession, requireSession, requireRole, requireOwner, verifyToken };
export type { SessionPayload };

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'No autenticado', code: 'UNAUTHORIZED' }, { status: 401 });
}

export function forbidden(): NextResponse {
  return NextResponse.json({ error: 'Acceso no autorizado', code: 'FORBIDDEN' }, { status: 403 });
}
