import { ForbiddenError } from '@/lib/errors/http-errors';
import {
  verifyToken,
  getSession,
  requireSession,
  requireRole,
  requireOwner,
} from './guards';
import type { SessionPayload } from './guards';

export { verifyToken, getSession, requireSession, requireRole, requireOwner };
export type { SessionPayload };

export async function requireAdminSession(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.rol !== 'admin') throw new ForbiddenError();
  return session;
}
