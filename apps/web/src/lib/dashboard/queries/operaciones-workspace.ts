import 'server-only';
import { query, queryOne } from '@expressmx/database';

export type EstatusOrden =
  | 'solicitada'
  | 'asignada'
  | 'en_camino'
  | 'en_progreso'
  | 'completada'
  | 'cancelada';

export interface OperacionesQueueCounts {
  sin_asignar: number;
  en_riesgo_sla: number;
  en_curso: number;
  completadas_hoy: number;
  mis_asignaciones: number;
}

const SLA_MIN_SOLICITADA = 30;

export async function getOperacionesQueueCounts(
  viewerId: string,
): Promise<OperacionesQueueCounts> {
  const row = await queryOne<OperacionesQueueCounts>(
    `SELECT
       (SELECT COUNT(*) FROM ordenes_servicio
        WHERE estatus = 'solicitada')::INT AS sin_asignar,
       (SELECT COUNT(*) FROM ordenes_servicio
        WHERE estatus = 'solicitada'
          AND created_at < NOW() - ($1 || ' minutes')::INTERVAL)::INT AS en_riesgo_sla,
       (SELECT COUNT(*) FROM ordenes_servicio
        WHERE estatus IN ('asignada', 'en_camino', 'en_progreso'))::INT AS en_curso,
       (SELECT COUNT(*) FROM ordenes_servicio
        WHERE estatus = 'completada'
          AND DATE(updated_at) = CURRENT_DATE)::INT AS completadas_hoy,
       (SELECT COUNT(*) FROM ordenes_servicio
        WHERE prestador_id = $2
          AND estatus IN ('asignada', 'en_camino', 'en_progreso'))::INT AS mis_asignaciones`,
    [SLA_MIN_SOLICITADA, viewerId],
  );
  return (
    row ?? {
      sin_asignar: 0,
      en_riesgo_sla: 0,
      en_curso: 0,
      completadas_hoy: 0,
      mis_asignaciones: 0,
    }
  );
}

export interface QueueOrden {
  id: string;
  estatus: EstatusOrden;
  servicio_nombre: string;
  cliente_nombre: string;
  prestador_nombre: string | null;
  monto_total: string;
  fecha_programada: string;
  created_at: string;
  espera_minutos: number;
}

type Bucket = 'sin_asignar' | 'sla_riesgo' | 'en_curso' | 'completadas' | 'mias';

export async function listarColaOrdenes(
  viewerId: string,
  bucket: Bucket,
  limit = 30,
): Promise<QueueOrden[]> {
  let where: string;
  const args: unknown[] = [];
  let orderBy = 'o.created_at DESC';

  if (bucket === 'sin_asignar') {
    where = `o.estatus = 'solicitada'`;
    orderBy = 'o.created_at ASC';
  } else if (bucket === 'sla_riesgo') {
    args.push(SLA_MIN_SOLICITADA);
    where = `o.estatus = 'solicitada' AND o.created_at < NOW() - ($1 || ' minutes')::INTERVAL`;
    orderBy = 'o.created_at ASC';
  } else if (bucket === 'en_curso') {
    where = `o.estatus IN ('asignada', 'en_camino', 'en_progreso')`;
    orderBy = 'o.fecha_programada ASC';
  } else if (bucket === 'completadas') {
    where = `o.estatus = 'completada' AND DATE(o.updated_at) = CURRENT_DATE`;
  } else {
    args.push(viewerId);
    where = `o.prestador_id = $${args.length} AND o.estatus IN ('asignada', 'en_camino', 'en_progreso')`;
    orderBy = 'o.fecha_programada ASC';
  }

  args.push(limit);
  return await query<QueueOrden>(
    `SELECT
       o.id,
       o.estatus::text AS estatus,
       s.nombre AS servicio_nombre,
       uc.nombre || ' ' || uc.apellidos AS cliente_nombre,
       (SELECT up.nombre || ' ' || up.apellidos
          FROM usuarios up WHERE up.id = o.prestador_id) AS prestador_nombre,
       o.monto_total::text AS monto_total,
       o.fecha_programada,
       o.created_at,
       EXTRACT(EPOCH FROM (NOW() - o.created_at))::INT / 60 AS espera_minutos
     FROM ordenes_servicio o
     JOIN servicios s ON s.id = o.servicio_id
     JOIN usuarios uc ON uc.id = o.cliente_id
     WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT $${args.length}`,
    args,
  );
}

export interface OrdenDetalle {
  id: string;
  estatus: EstatusOrden;
  fecha_programada: string;
  monto_total: string;
  descuento: string;
  notas_cliente: string | null;
  notas_prestador: string | null;
  created_at: string;
  updated_at: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono: string | null;
  servicio_id: string;
  servicio_nombre: string;
  categoria_nombre: string;
  duracion_estimada_min: number | null;
  prestador_id: string | null;
  prestador_nombre: string | null;
  prestador_email: string | null;
  direccion_id: string;
  direccion_calle: string;
  direccion_numero_ext: string;
  direccion_colonia: string;
  direccion_ciudad: string;
  direccion_lat: string | null;
  direccion_lng: string | null;
}

export async function getOrdenDetalle(ordenId: string): Promise<OrdenDetalle | null> {
  return await queryOne<OrdenDetalle>(
    `SELECT
       o.id,
       o.estatus::text AS estatus,
       o.fecha_programada,
       o.monto_total::text AS monto_total,
       o.descuento::text AS descuento,
       o.notas_cliente,
       o.notas_prestador,
       o.created_at,
       o.updated_at,
       o.cliente_id,
       uc.nombre || ' ' || uc.apellidos AS cliente_nombre,
       uc.email AS cliente_email,
       uc.telefono AS cliente_telefono,
       o.servicio_id,
       s.nombre AS servicio_nombre,
       cat.nombre AS categoria_nombre,
       s.duracion_estimada_min,
       o.prestador_id,
       (SELECT up.nombre || ' ' || up.apellidos FROM usuarios up WHERE up.id = o.prestador_id) AS prestador_nombre,
       (SELECT up.email FROM usuarios up WHERE up.id = o.prestador_id) AS prestador_email,
       o.direccion_id,
       d.calle AS direccion_calle,
       d.numero_ext AS direccion_numero_ext,
       d.colonia AS direccion_colonia,
       d.ciudad AS direccion_ciudad,
       d.latitud::text AS direccion_lat,
       d.longitud::text AS direccion_lng
     FROM ordenes_servicio o
     JOIN servicios s ON s.id = o.servicio_id
     JOIN categorias_servicio cat ON cat.id = s.categoria_id
     JOIN usuarios uc ON uc.id = o.cliente_id
     JOIN direcciones d ON d.id = o.direccion_id
     WHERE o.id = $1`,
    [ordenId],
  );
}

export interface PrestadorCandidato {
  id: string;
  nombre: string;
  email: string;
  rating: string | null;
  ordenes_completadas: number;
  ofrece_servicio: boolean;
  distancia_km: string | null;
}

export async function getPrestadoresCercanos(
  ordenId: string,
  limit = 8,
): Promise<PrestadorCandidato[]> {
  return await query<PrestadorCandidato>(
    `WITH orden AS (
       SELECT o.id, o.servicio_id, d.latitud AS lat, d.longitud AS lng
       FROM ordenes_servicio o
       JOIN direcciones d ON d.id = o.direccion_id
       WHERE o.id = $1
     )
     SELECT
       u.id,
       u.nombre || ' ' || u.apellidos AS nombre,
       u.email,
       (SELECT ROUND(AVG(c.puntuacion)::NUMERIC, 1)::text
          FROM calificaciones c WHERE c.calificado_id = u.id) AS rating,
       (SELECT COUNT(*)::INT FROM ordenes_servicio o2
          WHERE o2.prestador_id = u.id AND o2.estatus = 'completada') AS ordenes_completadas,
       TRUE AS ofrece_servicio,
       (
         SELECT ROUND(MIN(
           SQRT(
             POW((dp.zona_lat - orden.lat)::NUMERIC * 111, 2) +
             POW((dp.zona_lng - orden.lng)::NUMERIC * 111 *
               COS(RADIANS(orden.lat::NUMERIC)), 2)
           )
         )::NUMERIC, 1)::text
         FROM disponibilidad_prestador dp, orden
         WHERE dp.prestador_id = u.id
       ) AS distancia_km
     FROM usuarios u
     CROSS JOIN LATERAL public.validar_prestador_para_orden($1::uuid, u.id) elegibilidad
     WHERE u.rol = 'prestador'
       AND u.activo = TRUE
       AND u.recibe_ordenes = TRUE
       AND elegibilidad.elegible = TRUE
     ORDER BY distancia_km ASC NULLS LAST,
              rating DESC NULLS LAST,
              ordenes_completadas DESC
     LIMIT $2`,
    [ordenId, limit],
  );
}
