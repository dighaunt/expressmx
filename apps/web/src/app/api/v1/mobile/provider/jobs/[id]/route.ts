import { NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { idParamSchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import { NotFoundError } from '@/lib/errors/http-errors';

export const GET = defineEndpoint({
  tag: 'GET /api/mobile/provider/jobs/[id]',
  auth: { role: ['prestador'] },
  paramsSchema: idParamSchema,
  handler: async ({ params, session }) => {
    const orden = await queryOne<{
      id: string;
      estatus: string;
      servicio_nombre: string;
      servicio_descripcion: string | null;
      servicio_duracion_min: number | null;
      cliente_nombre: string;
      cliente_telefono: string | null;
      cliente_rating: string | null;
      cliente_zona: string | null;
      direccion: string | null;
      direccion_referencia: string | null;
      direccion_latitud: string | null;
      direccion_longitud: string | null;
      fecha_programada: string | null;
      notas: string | null;
      total: string;
      aceptada_at: string | null;
      en_camino_at: string | null;
      en_progreso_at: string | null;
      completada_at: string | null;
    }>(
      `SELECT
        o.id,
        o.estatus,
        s.nombre AS servicio_nombre,
        s.descripcion AS servicio_descripcion,
        s.duracion_estimada_min AS servicio_duracion_min,
        CONCAT(c.nombre, ' ', c.apellidos) AS cliente_nombre,
        c.telefono AS cliente_telefono,
        (
          SELECT AVG(cal.puntuacion)::numeric(3,2)
          FROM calificaciones cal
          WHERE cal.calificado_id = c.id
        ) AS cliente_rating,
        d.colonia AS cliente_zona,
        CONCAT(d.calle, ' ', d.numero_ext, ', ', d.colonia, ', ', d.ciudad) AS direccion,
        NULLIF(CONCAT_WS(' · ', d.numero_int, d.referencia), '') AS direccion_referencia,
        d.latitud::text AS direccion_latitud,
        d.longitud::text AS direccion_longitud,
        o.fecha_programada,
        o.notas_cliente AS notas,
        o.monto_total AS total,
        (
          SELECT h.created_at FROM historial_estatus_orden h
          WHERE h.orden_id = o.id AND h.estatus_nuevo = 'asignada'
          ORDER BY h.created_at ASC LIMIT 1
        ) AS aceptada_at,
        (
          SELECT h.created_at FROM historial_estatus_orden h
          WHERE h.orden_id = o.id AND h.estatus_nuevo = 'en_camino'
          ORDER BY h.created_at ASC LIMIT 1
        ) AS en_camino_at,
        (
          SELECT h.created_at FROM historial_estatus_orden h
          WHERE h.orden_id = o.id AND h.estatus_nuevo = 'en_progreso'
          ORDER BY h.created_at ASC LIMIT 1
        ) AS en_progreso_at,
        (
          SELECT h.created_at FROM historial_estatus_orden h
          WHERE h.orden_id = o.id AND h.estatus_nuevo = 'completada'
          ORDER BY h.created_at ASC LIMIT 1
        ) AS completada_at
       FROM ordenes_servicio o
       JOIN servicios s ON s.id = o.servicio_id
       JOIN usuarios c ON c.id = o.cliente_id
       LEFT JOIN direcciones d ON d.id = o.direccion_id
       WHERE o.id = $1 AND o.prestador_id = $2`,
      [params.id, session!.sub]
    );

    if (!orden) throw new NotFoundError('Trabajo no encontrado');

    return NextResponse.json({
      orden: {
        ...orden,
        direccion_latitud:
          orden.direccion_latitud === null ? null : Number(orden.direccion_latitud),
        direccion_longitud:
          orden.direccion_longitud === null ? null : Number(orden.direccion_longitud),
        cliente_rating: orden.cliente_rating === null ? null : Number(orden.cliente_rating),
        total: Number(orden.total),
      },
    });
  },
});
