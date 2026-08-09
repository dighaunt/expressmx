import 'server-only';
import { query, queryOne } from '@expressmx/database';

export interface AdminListItem {
  id: string;
  usuario_id: string;
  nombre: string;
  apellidos: string;
  email: string;
  avatar_url: string | null;
  rol_id: string;
  rol_nombre: string;
  activo: boolean;
  ultimo_acceso: string | null;
  created_at: string;
}

export interface AdminDetail extends AdminListItem {
  rol_descripcion: string | null;
  rol_activo: boolean;
  permisos_count: number;
}

export interface UsuarioBuscado {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  avatar_url: string | null;
  ya_es_admin: boolean;
  admin_id: string | null;
  admin_activo: boolean | null;
}

export interface AdminFilter {
  q?: string;
  estado?: 'todos' | 'activos' | 'inactivos';
  rolId?: string;
}

export async function listarAdmins(filter: AdminFilter = {}): Promise<AdminListItem[]> {
  const where: string[] = [];
  const args: unknown[] = [];

  if (filter.q && filter.q.trim()) {
    args.push(`%${filter.q.trim().toLowerCase()}%`);
    where.push(
      `(LOWER(u.nombre || ' ' || u.apellidos) LIKE $${args.length} OR LOWER(u.email) LIKE $${args.length})`,
    );
  }
  if (filter.estado === 'activos') where.push(`ua.activo = TRUE`);
  else if (filter.estado === 'inactivos') where.push(`ua.activo = FALSE`);
  if (filter.rolId) {
    args.push(filter.rolId);
    where.push(`ua.rol_id = $${args.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  return await query<AdminListItem>(
    `SELECT
       ua.id,
       ua.usuario_id,
       u.nombre,
       u.apellidos,
       u.email,
       u.avatar_url,
       ua.rol_id,
       r.nombre AS rol_nombre,
       ua.activo,
       ua.ultimo_acceso,
       ua.created_at
     FROM usuarios_admin ua
     JOIN usuarios u ON u.id = ua.usuario_id
     JOIN roles_admin r ON r.id = ua.rol_id
     ${whereSql}
     ORDER BY ua.activo DESC, u.nombre`,
    args,
  );
}

export async function getAdmin(id: string): Promise<AdminDetail | null> {
  return await queryOne<AdminDetail>(
    `SELECT
       ua.id,
       ua.usuario_id,
       u.nombre,
       u.apellidos,
       u.email,
       u.avatar_url,
       ua.rol_id,
       r.nombre AS rol_nombre,
       r.descripcion AS rol_descripcion,
       r.activo AS rol_activo,
       ua.activo,
       ua.ultimo_acceso,
       ua.created_at,
       (SELECT COUNT(*) FROM roles_permisos rp WHERE rp.rol_id = r.id)::INT AS permisos_count
     FROM usuarios_admin ua
     JOIN usuarios u ON u.id = ua.usuario_id
     JOIN roles_admin r ON r.id = ua.rol_id
     WHERE ua.id = $1`,
    [id],
  );
}

export async function buscarUsuariosParaAdmin(q: string): Promise<UsuarioBuscado[]> {
  const term = q.trim().toLowerCase();
  if (term.length < 2) return [];

  return await query<UsuarioBuscado>(
    `SELECT
       u.id,
       u.nombre,
       u.apellidos,
       u.email,
       u.avatar_url,
       (ua.id IS NOT NULL) AS ya_es_admin,
       ua.id AS admin_id,
       ua.activo AS admin_activo
     FROM usuarios u
     LEFT JOIN usuarios_admin ua ON ua.usuario_id = u.id
     WHERE u.activo = TRUE
       AND u.rol = 'admin'
       AND (LOWER(u.email) LIKE $1 OR LOWER(u.nombre || ' ' || u.apellidos) LIKE $1)
     ORDER BY u.email
     LIMIT 12`,
    [`%${term}%`],
  );
}

export async function rolesActivos(): Promise<Array<{ id: string; nombre: string }>> {
  return await query<{ id: string; nombre: string }>(
    `SELECT id, nombre FROM roles_admin WHERE activo = TRUE ORDER BY nombre`,
  );
}
