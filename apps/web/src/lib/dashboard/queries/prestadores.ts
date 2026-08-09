import 'server-only';
import { query, queryOne } from '@expressmx/database';

export interface PrestadorListItem {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  activo: boolean;
  recibe_ordenes: boolean;
  restringido: boolean;
  servicios_count: number;
  ordenes_completadas: number;
  rating_promedio: number | null;
  created_at: string;
}

export interface PrestadorDetail extends PrestadorListItem {
  curp: string | null;
  fecha_nacimiento: string | null;
  motivo_restriccion: string | null;
  restringido_en: string | null;
  avatar_url: string | null;
  cuenta_bancaria_id: string | null;
  cuenta_bancaria_titular: string | null;
  cuenta_bancaria_banco_codigo: string | null;
  cuenta_bancaria_banco: string | null;
  cuenta_bancaria_clabe_ultimos4: string | null;
  cuenta_bancaria_estatus: 'pendiente' | 'verificada' | 'rechazada' | null;
  cuenta_bancaria_updated_at: string | null;
}

export interface DocumentoRow {
  id: string;
  tipo: 'ine' | 'curp' | 'domicilio' | 'certificacion';
  archivo_url: string;
  estatus: 'pendiente' | 'aprobado' | 'rechazado';
  fecha_expiracion: string | null;
  created_at: string;
}

export interface PrestadorServicioRow {
  id: string;
  nombre: string;
  categoria_nombre: string;
  servicio_activo: boolean;
  habilitado: boolean;
}

export interface PrestadorTurnoRow {
  id: string;
  dia: 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom';
  hora_inicio: string;
  hora_fin: string;
  zona_id: string | null;
  zona_nombre: string | null;
}

export interface PrestadoresFilter {
  q?: string;
  estado?: 'todos' | 'en_turno' | 'fuera_turno' | 'restringidos' | 'inactivos';
  limit?: number;
  offset?: number;
}

export async function listarPrestadores(filter: PrestadoresFilter = {}): Promise<{
  total: number;
  rows: PrestadorListItem[];
}> {
  const where: string[] = [`u.rol = 'prestador'`];
  const args: unknown[] = [];

  if (filter.q && filter.q.trim()) {
    args.push(`%${filter.q.trim().toLowerCase()}%`);
    where.push(
      `(LOWER(u.nombre || ' ' || u.apellidos) LIKE $${args.length} OR LOWER(u.email) LIKE $${args.length} OR u.telefono LIKE $${args.length})`,
    );
  }
  if (filter.estado === 'en_turno') {
    where.push(`u.activo = TRUE AND u.recibe_ordenes = TRUE AND u.restringido_en IS NULL`);
  } else if (filter.estado === 'fuera_turno') {
    where.push(`u.activo = TRUE AND u.recibe_ordenes = FALSE AND u.restringido_en IS NULL`);
  } else if (filter.estado === 'restringidos') {
    where.push(`u.restringido_en IS NOT NULL`);
  } else if (filter.estado === 'inactivos') {
    where.push(`u.activo = FALSE`);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);

  const totalRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*) AS total FROM usuarios u ${whereSql}`,
    args,
  );

  args.push(limit, offset);
  const rows = await query<PrestadorListItem>(
    `SELECT
       u.id,
       u.nombre,
       u.apellidos,
       u.email,
       u.telefono,
       u.activo,
       u.recibe_ordenes,
       (u.restringido_en IS NOT NULL) AS restringido,
       u.created_at,
       (SELECT COUNT(*) FROM servicios_prestador sp WHERE sp.prestador_id = u.id AND sp.activo = TRUE)::INT AS servicios_count,
       (SELECT COUNT(*) FROM ordenes_servicio o WHERE o.prestador_id = u.id AND o.estatus = 'completada')::INT AS ordenes_completadas,
       (SELECT ROUND(AVG(c.puntuacion)::NUMERIC, 1) FROM calificaciones c WHERE c.calificado_id = u.id) AS rating_promedio
     FROM usuarios u
     ${whereSql}
     ORDER BY u.created_at DESC
     LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );

  return {
    total: Number(totalRow?.total ?? 0),
    rows: rows.map((r) => ({
      ...r,
      rating_promedio: r.rating_promedio === null ? null : Number(r.rating_promedio),
    })),
  };
}

export async function getPrestador(id: string): Promise<PrestadorDetail | null> {
  const row = await queryOne<PrestadorDetail>(
    `SELECT
       u.id,
       u.nombre,
       u.apellidos,
       u.email,
       u.telefono,
       u.activo,
       u.recibe_ordenes,
       u.curp,
       to_char(u.fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento,
       u.avatar_url,
       u.motivo_restriccion,
       u.restringido_en,
       cb.id AS cuenta_bancaria_id,
       cb.titular AS cuenta_bancaria_titular,
       cb.banco_codigo AS cuenta_bancaria_banco_codigo,
       cb.banco_nombre AS cuenta_bancaria_banco,
       cb.clabe_ultimos4 AS cuenta_bancaria_clabe_ultimos4,
       cb.estatus AS cuenta_bancaria_estatus,
       cb.updated_at AS cuenta_bancaria_updated_at,
       (u.restringido_en IS NOT NULL) AS restringido,
       u.created_at,
       (SELECT COUNT(*) FROM servicios_prestador sp WHERE sp.prestador_id = u.id AND sp.activo = TRUE)::INT AS servicios_count,
       (SELECT COUNT(*) FROM ordenes_servicio o WHERE o.prestador_id = u.id AND o.estatus = 'completada')::INT AS ordenes_completadas,
       (SELECT ROUND(AVG(c.puntuacion)::NUMERIC, 1) FROM calificaciones c WHERE c.calificado_id = u.id) AS rating_promedio
     FROM usuarios u
     LEFT JOIN cuentas_bancarias_prestador cb ON cb.prestador_id = u.id
     WHERE u.id = $1 AND u.rol = 'prestador'`,
    [id],
  );
  if (!row) return null;
  return {
    ...row,
    rating_promedio: row.rating_promedio === null ? null : Number(row.rating_promedio),
  };
}

export async function listarDocumentosPrestador(prestadorId: string): Promise<DocumentoRow[]> {
  return query<DocumentoRow>(
    `SELECT id, tipo, archivo_url, estatus,
            to_char(fecha_expiracion, 'YYYY-MM-DD') AS fecha_expiracion,
            created_at
     FROM documentos_prestador
     WHERE prestador_id = $1
     ORDER BY
       CASE estatus WHEN 'pendiente' THEN 0 WHEN 'rechazado' THEN 1 ELSE 2 END,
       created_at DESC`,
    [prestadorId],
  );
}

export async function listarServiciosAsignablesPrestador(
  prestadorId: string,
): Promise<PrestadorServicioRow[]> {
  return query<PrestadorServicioRow>(
    `SELECT
       s.id,
       s.nombre,
       c.nombre AS categoria_nombre,
       s.activo AS servicio_activo,
       COALESCE(sp.activo, FALSE) AS habilitado
     FROM servicios s
     JOIN categorias_servicio c ON c.id = s.categoria_id
     LEFT JOIN servicios_prestador sp
       ON sp.servicio_id = s.id AND sp.prestador_id = $1
     WHERE s.activo = TRUE OR sp.id IS NOT NULL
     ORDER BY c.orden_despliegue, c.nombre, s.nombre`,
    [prestadorId],
  );
}

export async function listarTurnosPrestador(prestadorId: string): Promise<PrestadorTurnoRow[]> {
  return query<PrestadorTurnoRow>(
    `SELECT
       d.id,
       d.dia,
       to_char(d.hora_inicio, 'HH24:MI') AS hora_inicio,
       to_char(d.hora_fin, 'HH24:MI') AS hora_fin,
       z.zona_id AS zona_id,
       z.zona_nombre AS zona_nombre
     FROM disponibilidad_prestador d
     LEFT JOIN LATERAL public.zona_operativa_para_punto(d.zona_lat, d.zona_lng) z ON TRUE
     WHERE d.prestador_id = $1
     ORDER BY
       CASE d.dia
         WHEN 'lun' THEN 1
         WHEN 'mar' THEN 2
         WHEN 'mie' THEN 3
         WHEN 'jue' THEN 4
         WHEN 'vie' THEN 5
         WHEN 'sab' THEN 6
         ELSE 7
       END,
       d.hora_inicio`,
    [prestadorId],
  );
}
