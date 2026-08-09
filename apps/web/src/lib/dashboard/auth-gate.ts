import 'server-only';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { ForbiddenError } from '@/lib/errors/http-errors';
import { buildViewer, tienePermiso, type Viewer } from '@/lib/dashboard/rbac';

export async function getViewer(): Promise<Viewer | null> {
  const session = await getSession();
  if (!session) return null;
  return buildViewer(session.sub);
}

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  return viewer;
}

export async function requirePermiso(permiso: string): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!tienePermiso(viewer, permiso)) {
    throw new ForbiddenError('No tienes permiso para acceder a esta sección');
  }
  return viewer;
}

export async function requireSuperAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.esSuperAdmin) {
    throw new ForbiddenError('Solo superadmin puede acceder a las vistas administrativas');
  }
  return viewer;
}
