import 'server-only';
import { query, queryOne } from '@expressmx/database';

export interface RolListItem {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  count_permisos: number;
  count_admins: number;
  count_admins_activos: number;
  created_at: string;
}

export interface RolDetail {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
  count_admins: number;
  count_admins_activos: number;
  permisos_asignados: string[];
}

export interface PermisoRow {
  id: string;
  clave: string;
  descripcion: string | null;
  modulo: string;
}

export interface PermisosPorModulo {
  modulo: string;
  permisos: PermisoRow[];
}

export async function listarRoles(): Promise<RolListItem[]> {
  return await query<RolListItem>(
    `SELECT
       r.id,
       r.nombre,
       r.descripcion,
       r.activo,
       r.created_at,
       (SELECT COUNT(*) FROM roles_permisos rp WHERE rp.rol_id = r.id)::INT AS count_permisos,
       (SELECT COUNT(*) FROM usuarios_admin ua WHERE ua.rol_id = r.id)::INT AS count_admins,
       (SELECT COUNT(*) FROM usuarios_admin ua WHERE ua.rol_id = r.id AND ua.activo = TRUE)::INT AS count_admins_activos
     FROM roles_admin r
     ORDER BY r.nombre`,
  );
}

export async function getRol(id: string): Promise<RolDetail | null> {
  const base = await queryOne<{
    id: string;
    nombre: string;
    descripcion: string | null;
    activo: boolean;
    created_at: string;
    count_admins: number;
    count_admins_activos: number;
  }>(
    `SELECT
       r.id,
       r.nombre,
       r.descripcion,
       r.activo,
       r.created_at,
       (SELECT COUNT(*) FROM usuarios_admin ua WHERE ua.rol_id = r.id)::INT AS count_admins,
       (SELECT COUNT(*) FROM usuarios_admin ua WHERE ua.rol_id = r.id AND ua.activo = TRUE)::INT AS count_admins_activos
     FROM roles_admin r
     WHERE r.id = $1`,
    [id],
  );
  if (!base) return null;

  const claves = await query<{ clave: string }>(
    `SELECT p.clave
     FROM roles_permisos rp
     JOIN permisos p ON p.id = rp.permiso_id
     WHERE rp.rol_id = $1`,
    [id],
  );

  return {
    ...base,
    permisos_asignados: claves.map((r) => r.clave),
  };
}

export async function listarPermisosAgrupados(): Promise<PermisosPorModulo[]> {
  const rows = await query<PermisoRow>(
    `SELECT id, clave, descripcion, modulo
     FROM permisos
     ORDER BY modulo, clave`,
  );

  const agrupados = new Map<string, PermisoRow[]>();
  for (const row of rows) {
    const arr = agrupados.get(row.modulo);
    if (arr) arr.push(row);
    else agrupados.set(row.modulo, [row]);
  }

  return Array.from(agrupados.entries()).map(([modulo, permisos]) => ({ modulo, permisos }));
}

export async function rolPorNombre(nombre: string): Promise<{ id: string } | null> {
  return await queryOne<{ id: string }>(
    `SELECT id FROM roles_admin WHERE nombre = $1`,
    [nombre],
  );
}
