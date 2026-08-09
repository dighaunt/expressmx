import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { requireRole } from '@/lib/auth/mobile';
import { ForbiddenError } from '@/lib/errors/http-errors';

export const PATCH = withApiHandler(async (req: NextRequest) => {
  await requireRole(req, 'prestador');
  throw new ForbiddenError('Operaciones administra las capacidades de los empleados');
}, 'PATCH /api/mobile/provider/services/[id]');

export const DELETE = withApiHandler(async (req: NextRequest) => {
  await requireRole(req, 'prestador');
  throw new ForbiddenError('Operaciones administra las capacidades de los empleados');
}, 'DELETE /api/mobile/provider/services/[id]');
