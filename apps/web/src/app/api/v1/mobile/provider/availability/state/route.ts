import { NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { defineEndpoint } from '@/lib/api/handler';
import { ForbiddenError } from '@/lib/errors/http-errors';

interface UserRow {
  recibe_ordenes: boolean;
  turno_activo: boolean;
  zona: string | null;
}

export const GET = defineEndpoint({
  tag: 'GET /api/v1/mobile/provider/availability/state',
  auth: { role: ['prestador'] },
  handler: async ({ session }) => {
    const userId = session!.sub;

    const user = await queryOne<UserRow>(
      `WITH ahora AS (
         SELECT
           NOW() AT TIME ZONE 'America/Mexico_City' AS local_now,
           CASE EXTRACT(ISODOW FROM NOW() AT TIME ZONE 'America/Mexico_City')::int
             WHEN 1 THEN 'lun'::dia_semana
             WHEN 2 THEN 'mar'::dia_semana
             WHEN 3 THEN 'mie'::dia_semana
             WHEN 4 THEN 'jue'::dia_semana
             WHEN 5 THEN 'vie'::dia_semana
             WHEN 6 THEN 'sab'::dia_semana
             ELSE 'dom'::dia_semana
           END AS dia
       ),
       turno AS (
         SELECT z.zona_nombre AS zona
           FROM disponibilidad_prestador d
           CROSS JOIN ahora
           LEFT JOIN LATERAL public.zona_operativa_para_punto(d.zona_lat, d.zona_lng) z ON TRUE
          WHERE d.prestador_id = $1
            AND d.dia = ahora.dia
            AND d.hora_inicio <= ahora.local_now::time
            AND d.hora_fin > ahora.local_now::time
          ORDER BY d.hora_inicio
          LIMIT 1
       )
       SELECT
         u.recibe_ordenes,
         EXISTS (SELECT 1 FROM turno) AS turno_activo,
         (SELECT zona FROM turno) AS zona
       FROM usuarios u
       WHERE u.id = $1`,
      [userId],
    );

    return NextResponse.json({
      data: {
        online: Boolean(user?.recibe_ordenes && user.turno_activo),
        zona: user?.zona ?? null,
      },
    });
  },
});

export const POST = defineEndpoint({
  tag: 'POST /api/v1/mobile/provider/availability/state',
  auth: { role: ['prestador'] },
  handler: async () => {
    throw new ForbiddenError('Operaciones administra los turnos de los empleados');
  },
});
