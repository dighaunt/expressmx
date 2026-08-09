import { NextResponse } from 'next/server';
import { query, queryOne } from '@expressmx/database';
import { idParamSchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import { NotFoundError, UnprocessableError } from '@/lib/errors/http-errors';

interface AddressRow {
  id: string;
  latitud: string | null;
  longitud: string | null;
}

interface SlotRow {
  starts_at: string;
  local_date: string;
  local_time: string;
  available_providers: number;
}

export const GET = defineEndpoint({
  tag: 'GET /api/v1/mobile/services/[id]/slots',
  auth: 'session',
  paramsSchema: idParamSchema,
  handler: async ({ params, session }) => {
    const service = await queryOne<{ id: string }>(
      `SELECT id FROM servicios WHERE id = $1 AND activo = TRUE`,
      [params.id],
    );
    if (!service) throw new NotFoundError('Servicio no encontrado');

    const address = await queryOne<AddressRow>(
      `SELECT id, latitud::text AS latitud, longitud::text AS longitud
         FROM direcciones
        WHERE usuario_id = $1
        ORDER BY predeterminada DESC, id ASC
        LIMIT 1`,
      [session!.sub],
    );
    if (!address) throw new UnprocessableError('Agrega una dirección antes de consultar horarios');
    if (address.latitud === null || address.longitud === null) {
      throw new UnprocessableError('Tu dirección necesita coordenadas para consultar horarios');
    }

    const slots = await query<SlotRow>(
      `WITH svc AS (
         SELECT id, COALESCE(duracion_estimada_min, 60) AS duracion
           FROM servicios
          WHERE id = $1
       ),
       candidates AS (
         SELECT
           gs AS local_start,
           gs + (svc.duracion || ' minutes')::interval AS local_end,
           gs AT TIME ZONE 'America/Mexico_City' AS starts_at,
           (gs + (svc.duracion || ' minutes')::interval) AT TIME ZONE 'America/Mexico_City' AS ends_at,
           svc.id AS servicio_id
         FROM svc
         CROSS JOIN generate_series(
           date_trunc('hour', NOW() AT TIME ZONE 'America/Mexico_City'),
           date_trunc('day', NOW() AT TIME ZONE 'America/Mexico_City') + INTERVAL '7 days',
           INTERVAL '30 minutes'
         ) gs
       ),
       counted AS (
         SELECT
           c.starts_at,
           c.local_start::date AS local_date,
           c.local_start::time AS local_time,
           (
             SELECT COUNT(DISTINCT u.id)::INT
               FROM servicios_prestador sp
               JOIN usuarios u ON u.id = sp.prestador_id
              WHERE sp.servicio_id = c.servicio_id
                AND sp.activo = TRUE
                AND u.rol = 'prestador'
                AND u.activo = TRUE
                AND u.recibe_ordenes = TRUE
                AND u.restringido_en IS NULL
                AND (
                  NOT EXISTS (
                    SELECT 1 FROM disponibilidad_prestador any_dp WHERE any_dp.prestador_id = u.id
                  )
                  OR EXISTS (
                    SELECT 1
                      FROM disponibilidad_prestador dp
                     WHERE dp.prestador_id = u.id
                       AND dp.dia = CASE EXTRACT(ISODOW FROM c.local_start)::int
                         WHEN 1 THEN 'lun'::dia_semana
                         WHEN 2 THEN 'mar'::dia_semana
                         WHEN 3 THEN 'mie'::dia_semana
                         WHEN 4 THEN 'jue'::dia_semana
                         WHEN 5 THEN 'vie'::dia_semana
                         WHEN 6 THEN 'sab'::dia_semana
                         ELSE 'dom'::dia_semana
                       END
                       AND c.local_start::date = c.local_end::date
                       AND dp.hora_inicio <= c.local_start::time
                       AND dp.hora_fin >= c.local_end::time
                       AND (
                         dp.zona_lat IS NULL
                         OR dp.zona_lng IS NULL
                         OR (
                           SQRT(
                             POW((dp.zona_lat - $2::numeric) * 111, 2) +
                             POW((dp.zona_lng - $3::numeric) * 111 * COS(RADIANS($2::numeric)), 2)
                           ) <= COALESCE(dp.radio_cobertura_km, 10)
                         )
                       )
                  )
                )
                AND NOT EXISTS (
                  SELECT 1
                    FROM ordenes_servicio ox
                    JOIN servicios sx ON sx.id = ox.servicio_id
                   WHERE ox.prestador_id = u.id
                     AND ox.estatus NOT IN ('completada', 'cancelada')
                     AND tstzrange(
                       ox.fecha_programada,
                       ox.fecha_programada + (COALESCE(sx.duracion_estimada_min, 60) || ' minutes')::interval
                     ) && tstzrange(c.starts_at, c.ends_at)
                )
           ) AS available_providers
         FROM candidates c
         WHERE c.local_start > (NOW() AT TIME ZONE 'America/Mexico_City') + INTERVAL '30 minutes'
           AND c.local_start::time >= TIME '08:00'
           AND c.local_end::time <= TIME '20:00'
       )
       SELECT
         to_char(starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS starts_at,
         local_date::text,
         to_char(local_time, 'HH24:MI') AS local_time,
         available_providers
       FROM counted
       WHERE available_providers > 0
       ORDER BY starts_at ASC
       LIMIT 40`,
      [params.id, address.latitud, address.longitud],
    );

    return NextResponse.json({
      data: {
        timezone: 'America/Mexico_City',
        server_time: new Date().toISOString(),
        slots,
      },
    });
  },
});
