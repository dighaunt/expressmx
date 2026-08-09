import { NextResponse } from 'next/server';
import { query, queryOne } from '@expressmx/database';
import { mobileProviderEarningsQuerySchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import { getCuentaBancariaPrestador } from '@/lib/dashboard/queries/cuentas-bancarias';

const SUELDO_BASE_QUINCENAL_DEFAULT = 4500;

interface RangeBoundaries {
  start: Date;
  bucketCount: number;
  bucketUnit: 'hour' | 'day' | 'week' | 'month';
}

function rangeBoundaries(rango: 'hoy' | 'semana' | 'mes' | 'anio'): RangeBoundaries {
  const now = new Date();
  if (rango === 'hoy') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { start, bucketCount: 24, bucketUnit: 'hour' };
  }
  if (rango === 'semana') {
    const start = new Date(now);
    const day = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
    return { start, bucketCount: 7, bucketUnit: 'day' };
  }
  if (rango === 'mes') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, bucketCount: 30, bucketUnit: 'day' };
  }
  const start = new Date(now.getFullYear(), 0, 1);
  return { start, bucketCount: 12, bucketUnit: 'month' };
}

interface SummaryRow {
  total: number;
  servicios: number;
}

interface RecientesRow {
  id: string;
  fecha: string;
  servicio: string;
  duracion_min: number | null;
  detalle: string | null;
  monto: number;
}

interface BucketRow {
  bucket: number;
  total: number;
}

export const GET = defineEndpoint({
  tag: 'GET /api/v1/mobile/provider/earnings',
  auth: { role: ['prestador'] },
  querySchema: mobileProviderEarningsQuerySchema,
  handler: async ({ query: q, session }) => {
    const userId = session!.sub;
    const rango = q.rango ?? 'semana';
    const range = rangeBoundaries(rango);

    const summary = await queryOne<SummaryRow>(
      `SELECT
         COALESCE(SUM(t.monto_prestador), 0)::FLOAT AS total,
         COUNT(*)::INT AS servicios
       FROM transacciones_prestador t
       WHERE t.prestador_id = $1 AND t.created_at >= $2`,
      [userId, range.start.toISOString()],
    );

    const recientes = await query<RecientesRow>(
      `SELECT
         t.id,
         t.created_at AS fecha,
         s.nombre AS servicio,
         o.notas_cliente AS detalle,
         o.monto_total AS duracion_min,
         t.monto_prestador AS monto
       FROM transacciones_prestador t
       JOIN ordenes_servicio o ON o.id = t.orden_id
       JOIN servicios s ON s.id = o.servicio_id
       WHERE t.prestador_id = $1 AND t.created_at >= $2
       ORDER BY t.created_at DESC
       LIMIT 20`,
      [userId, range.start.toISOString()],
    );

    const bucketSelect =
      range.bucketUnit === 'hour'
        ? `EXTRACT(HOUR FROM t.created_at)::INT`
        : range.bucketUnit === 'day'
          ? rango === 'semana'
            ? `((EXTRACT(DOW FROM t.created_at)::INT + 6) % 7)`
            : `EXTRACT(DAY FROM t.created_at)::INT - 1`
          : `EXTRACT(MONTH FROM t.created_at)::INT - 1`;

    const buckets = await query<BucketRow>(
      `SELECT ${bucketSelect} AS bucket, COALESCE(SUM(t.monto_prestador), 0)::FLOAT AS total
       FROM transacciones_prestador t
       WHERE t.prestador_id = $1 AND t.created_at >= $2
       GROUP BY 1
       ORDER BY 1`,
      [userId, range.start.toISOString()],
    );

    const trayectoria = new Array(range.bucketCount).fill(0);
    for (const b of buckets) {
      if (b.bucket >= 0 && b.bucket < range.bucketCount) {
        trayectoria[b.bucket] = Number(b.total);
      }
    }

    const sueldoBase = await queryOne<{ valor: string }>(
      `SELECT valor FROM config_sistema WHERE clave = 'sueldo_base_quincenal' LIMIT 1`,
    );
    const sueldo_base_quincenal = sueldoBase
      ? Number(sueldoBase.valor) || SUELDO_BASE_QUINCENAL_DEFAULT
      : SUELDO_BASE_QUINCENAL_DEFAULT;

    const [proxima, cuentaBancaria] = await Promise.all([
      queryOne<{
        fecha_corte: string;
        monto_total: string;
      }>(
        `SELECT fecha_corte, monto_total
         FROM cortes_pago
         WHERE prestador_id = $1 AND estatus = 'generado'
         ORDER BY fecha_corte ASC
         LIMIT 1`,
        [userId],
      ),
      getCuentaBancariaPrestador(userId),
    ]);

    return NextResponse.json({
      data: {
        rango,
        total: Number(summary?.total ?? 0),
        servicios: Number(summary?.servicios ?? 0),
        sueldo_base_quincenal,
        trayectoria,
        proxima_quincena: proxima
          ? {
              fecha: new Date(proxima.fecha_corte).toLocaleDateString('es-MX', {
                day: 'numeric',
                month: 'short',
              }),
              cuenta: cuentaBancaria?.clabe_mascara ?? null,
              monto_estimado: Number(proxima.monto_total) + sueldo_base_quincenal,
            }
          : null,
        recientes: recientes.map((r) => ({
          id: r.id,
          fecha: new Date(r.fecha).toLocaleString('es-MX', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }),
          servicio: r.servicio,
          duracion: r.duracion_min ? `${r.duracion_min} min` : '—',
          detalle: r.detalle ?? 'bono base',
          monto: Number(r.monto),
        })),
      },
    });
  },
});
