import 'server-only';
import { query, queryOne } from '@expressmx/database';

export interface ServicioListItem {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio_base: string;
  precio_maximo: string | null;
  duracion_estimada_min: number | null;
  activo: boolean;
  categoria_id: string;
  categoria_nombre: string;
  prestadores_count: number;
  ordenes_count: number;
}

export interface ServicioDetail extends ServicioListItem {}

export interface ServiciosFilter {
  q?: string;
  categoria_id?: string;
  estado?: 'todos' | 'activos' | 'inactivos';
  limit?: number;
  offset?: number;
}

export async function listarServicios(filter: ServiciosFilter = {}): Promise<{
  total: number;
  rows: ServicioListItem[];
}> {
  const where: string[] = [];
  const args: unknown[] = [];

  if (filter.q && filter.q.trim()) {
    args.push(`%${filter.q.trim().toLowerCase()}%`);
    where.push(
      `(LOWER(s.nombre) LIKE $${args.length} OR LOWER(COALESCE(s.descripcion, '')) LIKE $${args.length})`,
    );
  }
  if (filter.categoria_id) {
    args.push(filter.categoria_id);
    where.push(`s.categoria_id = $${args.length}`);
  }
  if (filter.estado === 'activos') {
    where.push(`s.activo = TRUE`);
  } else if (filter.estado === 'inactivos') {
    where.push(`s.activo = FALSE`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);

  const totalRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*) AS total FROM servicios s ${whereSql}`,
    args,
  );

  args.push(limit, offset);
  const rows = await query<ServicioListItem>(
    `SELECT
       s.id, s.nombre, s.descripcion, s.precio_base, s.precio_maximo,
       s.duracion_estimada_min, s.activo, s.categoria_id,
       c.nombre AS categoria_nombre,
       (SELECT COUNT(*) FROM servicios_prestador sp
          WHERE sp.servicio_id = s.id AND sp.activo = TRUE)::INT AS prestadores_count,
       (SELECT COUNT(*) FROM ordenes_servicio o
          WHERE o.servicio_id = s.id)::INT AS ordenes_count
     FROM servicios s
     JOIN categorias_servicio c ON c.id = s.categoria_id
     ${whereSql}
     ORDER BY c.orden_despliegue, c.nombre, s.nombre
     LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );

  return { total: Number(totalRow?.total ?? 0), rows };
}

export async function getServicio(id: string): Promise<ServicioDetail | null> {
  return queryOne<ServicioDetail>(
    `SELECT
       s.id, s.nombre, s.descripcion, s.precio_base, s.precio_maximo,
       s.duracion_estimada_min, s.activo, s.categoria_id,
       c.nombre AS categoria_nombre,
       (SELECT COUNT(*) FROM servicios_prestador sp
          WHERE sp.servicio_id = s.id AND sp.activo = TRUE)::INT AS prestadores_count,
       (SELECT COUNT(*) FROM ordenes_servicio o
          WHERE o.servicio_id = s.id)::INT AS ordenes_count
     FROM servicios s
     JOIN categorias_servicio c ON c.id = s.categoria_id
     WHERE s.id = $1`,
    [id],
  );
}

export interface CategoriaRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  icono_url: string | null;
  orden_despliegue: number;
  activa: boolean;
  servicios_count: number;
}

export async function listarCategorias(): Promise<CategoriaRow[]> {
  return query<CategoriaRow>(
    `SELECT
       c.id, c.nombre, c.descripcion, c.icono_url, c.orden_despliegue, c.activa,
       (SELECT COUNT(*) FROM servicios s WHERE s.categoria_id = c.id)::INT AS servicios_count
     FROM categorias_servicio c
     ORDER BY c.orden_despliegue, c.nombre`,
  );
}

export async function getCategoria(id: string): Promise<CategoriaRow | null> {
  return queryOne<CategoriaRow>(
    `SELECT
       c.id, c.nombre, c.descripcion, c.icono_url, c.orden_despliegue, c.activa,
       (SELECT COUNT(*) FROM servicios s WHERE s.categoria_id = c.id)::INT AS servicios_count
     FROM categorias_servicio c
     WHERE c.id = $1`,
    [id],
  );
}
