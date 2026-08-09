import { NextResponse } from 'next/server';
import { query, queryOne } from '@expressmx/database';
import { defineEndpoint } from '@/lib/api/handler';

interface SemanaRow {
  dia: number;
  total: number;
}

interface ResumenRow {
  servicios_hoy: number;
  bono_hoy: number;
  bono_semana: number;
  servicios_completados_total: number;
}

interface ProximaOrdenRow {
  id: string;
  servicio: string;
  fecha_programada: string;
  zona: string;
  cliente: string;
}

const SUELDO_BASE_QUINCENAL_DEFAULT = 4500;

export const GET = defineEndpoint({
  tag: 'GET /api/v1/mobile/provider/dashboard',
  auth: { role: ['prestador'] },
  handler: async ({ session }) => {
    const userId = session!.sub;

    const resumen = await queryOne<ResumenRow>(
      `SELECT
         COUNT(*) FILTER (
           WHERE o.estatus = 'completada' AND o.updated_at::date = CURRENT_DATE
         )::INT AS servicios_hoy,
         COALESCE(SUM(t.monto_prestador) FILTER (
           WHERE t.created_at::date = CURRENT_DATE
         ), 0)::FLOAT AS bono_hoy,
         COALESCE(SUM(t.monto_prestador) FILTER (
           WHERE t.created_at >= date_trunc('week', CURRENT_DATE)
         ), 0)::FLOAT AS bono_semana,
         (SELECT COUNT(*)::INT FROM ordenes_servicio o2
            WHERE o2.prestador_id = $1 AND o2.estatus = 'completada') AS servicios_completados_total
       FROM ordenes_servicio o
       LEFT JOIN transacciones_prestador t
         ON t.orden_id = o.id AND t.prestador_id = $1
       WHERE o.prestador_id = $1`,
      [userId],
    );

    const semana = await query<SemanaRow>(
      `WITH dias AS (
         SELECT generate_series(0, 6) AS dia
       )
       SELECT
         d.dia::INT AS dia,
         COALESCE(SUM(t.monto_prestador), 0)::FLOAT AS total
       FROM dias d
       LEFT JOIN transacciones_prestador t
         ON t.prestador_id = $1
         AND t.created_at::date = (date_trunc('week', CURRENT_DATE)::date + d.dia)
       GROUP BY d.dia
       ORDER BY d.dia`,
      [userId],
    );

    const max = semana.reduce((m, r) => Math.max(m, r.total), 0);
    const semana_barras = semana.map((r) => (max === 0 ? 4 : Math.round((r.total / max) * 100)));

    const proxima = await queryOne<ProximaOrdenRow>(
      `SELECT
         o.id,
         s.nombre AS servicio,
         o.fecha_programada,
         COALESCE(d.colonia, '—') AS zona,
         (u.nombre || ' ' || COALESCE(LEFT(u.apellidos, 1) || '.', '')) AS cliente
       FROM ordenes_servicio o
       JOIN servicios s ON s.id = o.servicio_id
       JOIN usuarios u ON u.id = o.cliente_id
       LEFT JOIN direcciones d ON d.id = o.direccion_id
       WHERE o.prestador_id = $1
         AND o.estatus IN ('asignada', 'en_camino')
       ORDER BY o.fecha_programada ASC
       LIMIT 1`,
      [userId],
    );

    const sueldoBase = await queryOne<{ valor: string }>(
      `SELECT valor FROM config_sistema WHERE clave = 'sueldo_base_quincenal' LIMIT 1`,
    );
    const sueldo_base_quincenal = sueldoBase
      ? Number(sueldoBase.valor) || SUELDO_BASE_QUINCENAL_DEFAULT
      : SUELDO_BASE_QUINCENAL_DEFAULT;

    return NextResponse.json({
      data: {
        servicios_hoy: resumen?.servicios_hoy ?? 0,
        bono_hoy: Number(resumen?.bono_hoy ?? 0),
        bono_semana: Number(resumen?.bono_semana ?? 0),
        sueldo_base_quincenal,
        servicios_completados_total: resumen?.servicios_completados_total ?? 0,
        semana_barras,
        proxima_orden: proxima
          ? {
              id: proxima.id,
              servicio: proxima.servicio,
              hora: new Date(proxima.fecha_programada).toLocaleString('es-MX', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              }),
              zona: proxima.zona,
              cliente: proxima.cliente,
            }
          : null,
      },
    });
  },
});
