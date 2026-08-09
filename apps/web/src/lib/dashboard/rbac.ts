import 'server-only';
import { query } from '@expressmx/database';
import type { Viewer } from '@/lib/dashboard/rbac-shared';

export {
  etiquetaDeRol,
  ROL_ETIQUETA,
  tieneAlgunPermiso,
  tienePermiso,
  type RolCanonico,
  type Viewer,
} from '@/lib/dashboard/rbac-shared';

interface ViewerRow {
  user_id: string;
  email: string;
  nombre: string;
  apellidos: string;
  avatar_url: string | null;
  rol_admin: string | null;
  permisos: string[] | null;
}

export async function buildViewer(userId: string): Promise<Viewer | null> {
  const rows = await query<ViewerRow>(
    `SELECT
       u.id AS user_id,
       u.email,
       u.nombre,
       u.apellidos,
       u.avatar_url,
       r.nombre AS rol_admin,
       COALESCE(
         ARRAY_AGG(DISTINCT p.clave) FILTER (WHERE p.clave IS NOT NULL),
         '{}'
       ) AS permisos
     FROM usuarios u
     LEFT JOIN usuarios_admin ua ON ua.usuario_id = u.id AND ua.activo = TRUE
     LEFT JOIN roles_admin r ON r.id = ua.rol_id AND r.activo = TRUE
     LEFT JOIN roles_permisos rp ON rp.rol_id = r.id
     LEFT JOIN permisos p ON p.id = rp.permiso_id
     WHERE u.id = $1
     GROUP BY u.id, r.nombre`,
    [userId],
  );

  const row = rows[0];
  if (!row) return null;

  const rolPrincipal = row.rol_admin ?? 'cliente';
  const esSuperAdmin = rolPrincipal === 'super_admin';
  const permisos = new Set<string>(row.permisos ?? []);

  return {
    userId: row.user_id,
    email: row.email,
    nombre: row.nombre,
    apellidos: row.apellidos,
    avatarUrl: row.avatar_url,
    rolPrincipal,
    rolesAsignados: rolPrincipal ? [rolPrincipal] : [],
    permisosEfectivos: permisos,
    esSuperAdmin,
  };
}
