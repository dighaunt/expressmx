import 'server-only';
import { query, queryOne } from '@expressmx/database';

export interface ComisionRow {
  id: string;
  categoria_id: string;
  categoria_nombre: string;
  porcentaje_base: string;
  porcentaje_volumen: string | null;
  umbral_ordenes_mes: number | null;
  vigencia_inicio: string;
  vigencia_fin: string | null;
  activa: boolean;
}

export interface InfoSistema {
  total_usuarios: number;
  total_clientes: number;
  total_prestadores: number;
  total_admins: number;
  total_ordenes: number;
  total_zonas: number;
  total_servicios: number;
  total_categorias: number;
  total_roles_admin: number;
  total_permisos: number;
}

export async function listarComisiones(): Promise<ComisionRow[]> {
  return await query<ComisionRow>(
    `SELECT
       c.id,
       c.categoria_id,
       cat.nombre AS categoria_nombre,
       c.porcentaje_base::text AS porcentaje_base,
       c.porcentaje_volumen::text AS porcentaje_volumen,
       c.umbral_ordenes_mes,
       to_char(c.vigencia_inicio, 'YYYY-MM-DD') AS vigencia_inicio,
       to_char(c.vigencia_fin, 'YYYY-MM-DD') AS vigencia_fin,
       c.activa
     FROM comisiones_plataforma c
     JOIN categorias_servicio cat ON cat.id = c.categoria_id
     ORDER BY c.activa DESC, cat.nombre, c.vigencia_inicio DESC`,
  );
}

export async function getComision(id: string): Promise<ComisionRow | null> {
  return await queryOne<ComisionRow>(
    `SELECT
       c.id,
       c.categoria_id,
       cat.nombre AS categoria_nombre,
       c.porcentaje_base::text AS porcentaje_base,
       c.porcentaje_volumen::text AS porcentaje_volumen,
       c.umbral_ordenes_mes,
       to_char(c.vigencia_inicio, 'YYYY-MM-DD') AS vigencia_inicio,
       to_char(c.vigencia_fin, 'YYYY-MM-DD') AS vigencia_fin,
       c.activa
     FROM comisiones_plataforma c
     JOIN categorias_servicio cat ON cat.id = c.categoria_id
     WHERE c.id = $1`,
    [id],
  );
}

export async function listarCategoriasParaComision(): Promise<
  Array<{ id: string; nombre: string }>
> {
  return await query<{ id: string; nombre: string }>(
    `SELECT id, nombre FROM categorias_servicio WHERE activa = TRUE ORDER BY nombre`,
  );
}

export async function getInfoSistema(): Promise<InfoSistema> {
  const row = await queryOne<InfoSistema>(
    `SELECT
       (SELECT COUNT(*) FROM usuarios)::INT AS total_usuarios,
       (SELECT COUNT(*) FROM usuarios WHERE rol = 'cliente')::INT AS total_clientes,
       (SELECT COUNT(*) FROM usuarios WHERE rol = 'prestador')::INT AS total_prestadores,
       (SELECT COUNT(*) FROM usuarios_admin WHERE activo = TRUE)::INT AS total_admins,
       (SELECT COUNT(*) FROM ordenes_servicio)::INT AS total_ordenes,
       (SELECT COUNT(*) FROM zonas_cobertura)::INT AS total_zonas,
       (SELECT COUNT(*) FROM servicios)::INT AS total_servicios,
       (SELECT COUNT(*) FROM categorias_servicio)::INT AS total_categorias,
       (SELECT COUNT(*) FROM roles_admin)::INT AS total_roles_admin,
       (SELECT COUNT(*) FROM permisos)::INT AS total_permisos`,
  );

  return (
    row ?? {
      total_usuarios: 0,
      total_clientes: 0,
      total_prestadores: 0,
      total_admins: 0,
      total_ordenes: 0,
      total_zonas: 0,
      total_servicios: 0,
      total_categorias: 0,
      total_roles_admin: 0,
      total_permisos: 0,
    }
  );
}
