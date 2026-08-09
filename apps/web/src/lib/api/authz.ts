import 'server-only';
import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { buildViewer, tienePermiso, type Viewer } from '@/lib/dashboard/rbac';
import { ForbiddenError } from '@/lib/errors/http-errors';

export async function requireApiPermiso(
  req: NextRequest,
  permiso: string,
): Promise<Viewer> {
  const session = await requireSession(req);
  if (session.rol !== 'admin') throw new ForbiddenError();

  const viewer = await buildViewer(session.sub);
  if (!viewer || !tienePermiso(viewer, permiso)) throw new ForbiddenError();

  return viewer;
}
