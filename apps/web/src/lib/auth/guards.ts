import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { queryOne } from '@expressmx/database';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/errors/http-errors';

const secretValue = process.env.JWT_SECRET;
if (!secretValue || secretValue.length < 32) {
  throw new Error('JWT_SECRET environment variable is required (min 32 chars)');
}
const SECRET = new TextEncoder().encode(secretValue);

export interface SessionPayload {
  sub: string;
  email: string;
  rol: string;
  iat: number;
  exp: number;
}

async function readToken(req?: NextRequest): Promise<string | null> {
  if (req) {
    const authHeader = req.headers.get('authorization') ?? '';
    if (authHeader.startsWith('Bearer ')) return authHeader.slice(7);
    return req.cookies.get('auth_token')?.value ?? null;
  }
  const store = await cookies();
  return store.get('auth_token')?.value ?? null;
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(req?: NextRequest): Promise<SessionPayload | null> {
  const token = await readToken(req);
  if (!token) return null;
  return verifyToken(token);
}

export async function requireSession(req?: NextRequest): Promise<SessionPayload> {
  const session = await getSession(req);
  if (!session) throw new UnauthorizedError();
  return session;
}

export async function requireRole(
  req: NextRequest | undefined,
  ...roles: string[]
): Promise<SessionPayload> {
  const session = await requireSession(req);
  if (!roles.includes(session.rol)) throw new ForbiddenError();
  return session;
}

export interface OwnerSpec {
  table: string;
  resourceId: string;
  userId: string;
  idColumn?: string;
  userColumn?: string;
}

export async function requireOwner(spec: OwnerSpec): Promise<void> {
  const idCol = spec.idColumn ?? 'id';
  const userCol = spec.userColumn ?? 'usuario_id';
  const found = await queryOne(
    `SELECT 1 FROM ${spec.table} WHERE ${idCol} = $1 AND ${userCol} = $2 LIMIT 1`,
    [spec.resourceId, spec.userId]
  );
  if (!found) throw new NotFoundError();
}
