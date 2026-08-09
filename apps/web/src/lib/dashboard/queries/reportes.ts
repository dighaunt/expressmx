import 'server-only';
import { query, queryOne } from '@expressmx/database';

export interface MetricasResumen {
  ordenes_mes: number;
  ordenes_mes_anterior: number;
  ingresos_mes: string;
  ingresos_mes_anterior: string;
  ticket_promedio_mes: string;
  prestadores_activos_mes: number;
  clientes_activos_mes: number;
  comision_plataforma_mes: string;
}

export interface OrdenesPorEstatus {
  estatus: string;
  total: number;
  monto: string;
}

export interface TopItem {
  id: string;
  nombre: string;
  total: number;
  ingresos: string;
}

export interface ServicioMasSolicitado extends TopItem {
  categoria: string;
}

export interface SerieMensual {
  mes: string;
  ordenes: number;
  ingresos: string;
}

export async function getMetricasResumen(): Promise<MetricasResumen> {
  const row = await queryOne<MetricasResumen>(
    `WITH actual AS (
       SELECT
         COUNT(*)::INT AS ordenes,
         COALESCE(SUM(monto_total), 0)::text AS ingresos,
         COUNT(DISTINCT prestador_id)::INT AS prestadores,
         COUNT(DISTINCT cliente_id)::INT AS clientes
       FROM ordenes_servicio
       WHERE created_at >= DATE_TRUNC('month', NOW())
         AND estatus = 'completada'
     ),
     anterior AS (
       SELECT
         COUNT(*)::INT AS ordenes,
         COALESCE(SUM(monto_total), 0)::text AS ingresos
       FROM ordenes_servicio
       WHERE created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month'
         AND created_at < DATE_TRUNC('month', NOW())
         AND estatus = 'completada'
     ),
     comision AS (
       SELECT COALESCE(SUM(t.comision_plataforma), 0)::text AS total
       FROM transacciones_prestador t
       WHERE t.created_at >= DATE_TRUNC('month', NOW())
     )
     SELECT
       a.ordenes AS ordenes_mes,
       p.ordenes AS ordenes_mes_anterior,
       a.ingresos AS ingresos_mes,
       p.ingresos AS ingresos_mes_anterior,
       CASE
         WHEN a.ordenes > 0 THEN (a.ingresos::numeric / a.ordenes)::text
         ELSE '0'
       END AS ticket_promedio_mes,
       a.prestadores AS prestadores_activos_mes,
       a.clientes AS clientes_activos_mes,
       c.total AS comision_plataforma_mes
     FROM actual a, anterior p, comision c`,
  );

  return (
    row ?? {
      ordenes_mes: 0,
      ordenes_mes_anterior: 0,
      ingresos_mes: '0',
      ingresos_mes_anterior: '0',
      ticket_promedio_mes: '0',
      prestadores_activos_mes: 0,
      clientes_activos_mes: 0,
      comision_plataforma_mes: '0',
    }
  );
}

export async function getOrdenesPorEstatus(): Promise<OrdenesPorEstatus[]> {
  return await query<OrdenesPorEstatus>(
    `SELECT
       estatus::text AS estatus,
       COUNT(*)::INT AS total,
       COALESCE(SUM(monto_total), 0)::text AS monto
     FROM ordenes_servicio
     WHERE created_at >= DATE_TRUNC('month', NOW())
     GROUP BY estatus
     ORDER BY total DESC`,
  );
}

export async function getTopCategorias(): Promise<TopItem[]> {
  return await query<TopItem>(
    `SELECT
       cat.id,
       cat.nombre,
       COUNT(o.id)::INT AS total,
       COALESCE(SUM(o.monto_total), 0)::text AS ingresos
     FROM ordenes_servicio o
     JOIN servicios s ON s.id = o.servicio_id
     JOIN categorias_servicio cat ON cat.id = s.categoria_id
     WHERE o.created_at >= DATE_TRUNC('month', NOW())
       AND o.estatus = 'completada'
     GROUP BY cat.id, cat.nombre
     ORDER BY ingresos DESC
     LIMIT 6`,
  );
}

export async function getTopPrestadores(): Promise<TopItem[]> {
  return await query<TopItem>(
    `SELECT
       u.id,
       u.nombre || ' ' || u.apellidos AS nombre,
       COUNT(o.id)::INT AS total,
       COALESCE(SUM(o.monto_total), 0)::text AS ingresos
     FROM ordenes_servicio o
     JOIN usuarios u ON u.id = o.prestador_id
     WHERE o.created_at >= DATE_TRUNC('month', NOW())
       AND o.estatus = 'completada'
     GROUP BY u.id, u.nombre, u.apellidos
     ORDER BY ingresos DESC
     LIMIT 8`,
  );
}

export async function getTopZonas(): Promise<TopItem[]> {
  return await query<TopItem>(
    `SELECT
       z.id,
       z.nombre,
       COUNT(o.id)::INT AS total,
       COALESCE(SUM(o.monto_total), 0)::text AS ingresos
     FROM ordenes_servicio o
     JOIN direcciones d ON d.id = o.direccion_id
     JOIN LATERAL public.zona_operativa_para_punto(
       d.latitud,
       d.longitud,
       o.servicio_id,
       o.fecha_programada::date
     ) zo ON TRUE
     JOIN zonas_cobertura z ON z.id = zo.zona_id
     WHERE o.created_at >= DATE_TRUNC('month', NOW())
       AND o.estatus = 'completada'
     GROUP BY z.id, z.nombre
     ORDER BY ingresos DESC
     LIMIT 6`,
  );
}

export async function getSerieUltimos6Meses(): Promise<SerieMensual[]> {
  return await query<SerieMensual>(
    `SELECT
       to_char(DATE_TRUNC('month', created_at), 'YYYY-MM') AS mes,
       COUNT(*)::INT AS ordenes,
       COALESCE(SUM(monto_total), 0)::text AS ingresos
     FROM ordenes_servicio
     WHERE created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
       AND estatus = 'completada'
     GROUP BY DATE_TRUNC('month', created_at)
     ORDER BY DATE_TRUNC('month', created_at)`,
  );
}
