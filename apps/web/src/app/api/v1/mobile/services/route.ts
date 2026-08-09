import { NextResponse } from 'next/server';
import { query } from '@expressmx/database';
import { mobileServicesQuerySchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';

export const GET = defineEndpoint({
  tag: 'GET /api/mobile/services',
  auth: 'public',
  querySchema: mobileServicesQuerySchema,
  handler: async ({ query: q }) => {
    const conditions: string[] = ['s.activo = true', 'cs.activa = true'];
    const params: unknown[] = [];
    let idx = 1;

    if (q.q) {
      conditions.push(`(s.nombre ILIKE $${idx} OR cs.nombre ILIKE $${idx})`);
      params.push(`%${q.q}%`);
      idx++;
    }

    if (q.categoria) {
      conditions.push(`cs.nombre ILIKE $${idx}`);
      params.push(`%${q.categoria}%`);
      idx++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const result = await query<{
      id: string;
      nombre: string;
      descripcion: string;
      precio_base: number;
      precio_maximo: number;
      duracion_estimada_min: number;
      categoria: string;
      prestadores_count: number;
      calificacion_promedio: number;
    }>(
      `SELECT
        s.id,
        s.nombre,
        s.descripcion,
        s.precio_base,
        s.precio_maximo,
        s.duracion_estimada_min,
        cs.nombre AS categoria,
        COUNT(DISTINCT sp.prestador_id) FILTER (
          WHERE sp.activo = TRUE
            AND p.activo = TRUE
            AND p.recibe_ordenes = TRUE
            AND p.restringido_en IS NULL
        )::INT AS prestadores_count,
        ROUND(AVG(c.puntuacion)::NUMERIC, 1) AS calificacion_promedio
       FROM servicios s
       JOIN categorias_servicio cs ON cs.id = s.categoria_id
       LEFT JOIN servicios_prestador sp ON sp.servicio_id = s.id
       LEFT JOIN usuarios p ON p.id = sp.prestador_id AND p.rol = 'prestador'
       LEFT JOIN calificaciones c ON c.orden_id IN (
         SELECT id FROM ordenes_servicio WHERE servicio_id = s.id
       )
       ${where}
       GROUP BY s.id, cs.nombre
       ORDER BY s.nombre`,
      params
    );

    return NextResponse.json({ servicios: result });
  },
});
