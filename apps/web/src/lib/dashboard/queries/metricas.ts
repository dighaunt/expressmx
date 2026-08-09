import 'server-only';
import { queryOne } from '@expressmx/database';

export interface MetricasGlobales {
  ordenes_hoy: number;
  ordenes_activas: number;
  prestadores_activos: number;
  clientes_total: number;
  ingreso_hoy: number;
  ingreso_mes: number;
  tickets_abiertos: number;
}

interface Row {
  ordenes_hoy: string;
  ordenes_activas: string;
  prestadores_activos: string;
  clientes_total: string;
  ingreso_hoy: string;
  ingreso_mes: string;
  tickets_abiertos: string;
}

export async function getMetricasGlobales(): Promise<MetricasGlobales> {
  const row = await queryOne<Row>(
    `SELECT
       (SELECT COUNT(*) FROM ordenes_servicio
          WHERE created_at::date = CURRENT_DATE) AS ordenes_hoy,
       (SELECT COUNT(*) FROM ordenes_servicio
          WHERE estatus IN ('solicitada','asignada','en_camino','en_progreso')) AS ordenes_activas,
       (SELECT COUNT(*) FROM usuarios
          WHERE rol = 'prestador' AND activo = TRUE AND recibe_ordenes = TRUE) AS prestadores_activos,
       (SELECT COUNT(*) FROM usuarios
          WHERE rol = 'cliente' AND activo = TRUE) AS clientes_total,
       (SELECT COALESCE(SUM(monto_total), 0) FROM ordenes_servicio
          WHERE estatus = 'completada' AND updated_at::date = CURRENT_DATE) AS ingreso_hoy,
       (SELECT COALESCE(SUM(monto_total), 0) FROM ordenes_servicio
          WHERE estatus = 'completada'
            AND updated_at >= date_trunc('month', CURRENT_DATE)) AS ingreso_mes,
       (SELECT COUNT(*) FROM tickets_soporte
          WHERE estatus IN ('abierto','en_revision','escalado')) AS tickets_abiertos`,
  );
  return {
    ordenes_hoy: Number(row?.ordenes_hoy ?? 0),
    ordenes_activas: Number(row?.ordenes_activas ?? 0),
    prestadores_activos: Number(row?.prestadores_activos ?? 0),
    clientes_total: Number(row?.clientes_total ?? 0),
    ingreso_hoy: Number(row?.ingreso_hoy ?? 0),
    ingreso_mes: Number(row?.ingreso_mes ?? 0),
    tickets_abiertos: Number(row?.tickets_abiertos ?? 0),
  };
}
