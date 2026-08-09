import { NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { defineEndpoint } from '@/lib/api/handler';

export const GET = defineEndpoint({
  tag: 'GET /api/mobile/provider/summary',
  auth: { role: ['prestador'] },
  handler: async ({ session }) => {
    const summary = await queryOne<{
      activos: number;
      completados_hoy: number;
      ganancias_hoy: number;
    }>(
      `SELECT
        COUNT(*) FILTER (WHERE o.estatus IN ('asignada','en_camino','en_progreso'))::INT AS activos,
        COUNT(*) FILTER (
          WHERE o.estatus = 'completada'
          AND o.updated_at::date = CURRENT_DATE
        )::INT AS completados_hoy,
        COALESCE(SUM(o.monto_total) FILTER (
          WHERE o.estatus = 'completada'
          AND o.updated_at::date = CURRENT_DATE
        ), 0) AS ganancias_hoy
       FROM ordenes_servicio o
       WHERE o.prestador_id = $1`,
      [session!.sub]
    );

    return NextResponse.json({ summary });
  },
});
