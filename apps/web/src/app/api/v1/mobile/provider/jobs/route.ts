import { NextResponse } from 'next/server';
import { query } from '@expressmx/database';
import { mobileProviderJobsQuerySchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import { buildPage, decodeCursor } from '@/lib/api/cursor';

interface JobRow {
  id: string;
  estatus: 'asignada' | 'en_camino' | 'en_progreso' | 'completada' | 'cancelada';
  created_at: string;
  servicio_nombre: string;
  cliente_nombre: string;
  zona: string | null;
  fecha_programada: string;
}

function formatHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const GET = defineEndpoint({
  tag: 'GET /api/v1/mobile/provider/jobs',
  auth: { role: ['prestador'] },
  querySchema: mobileProviderJobsQuerySchema,
  handler: async ({ query: q, session }) => {
    const limit = q.limit ?? 20;
    const cursor = q.cursor ? decodeCursor(q.cursor) : null;

    const rows = await query<JobRow>(
      `SELECT
        o.id,
        o.estatus,
        o.created_at,
        o.fecha_programada,
        s.nombre AS servicio_nombre,
        (c.nombre || ' ' || COALESCE(LEFT(c.apellidos, 1) || '.', '')) AS cliente_nombre,
        d.colonia AS zona
       FROM ordenes_servicio o
       JOIN servicios s ON s.id = o.servicio_id
       JOIN usuarios c ON c.id = o.cliente_id
       LEFT JOIN direcciones d ON d.id = o.direccion_id
       WHERE o.prestador_id = $1
         AND ($2::estatus_orden IS NULL OR o.estatus = $2::estatus_orden)
         AND ($3::timestamptz IS NULL OR (o.fecha_programada, o.id) < ($3::timestamptz, $4::uuid))
       ORDER BY o.fecha_programada DESC, o.id DESC
       LIMIT $5`,
      [session!.sub, q.estatus ?? null, cursor?.at ?? null, cursor?.id ?? null, limit + 1],
    );

    const page = buildPage(rows, limit, (row) => ({ at: row.fecha_programada, id: row.id }));

    return NextResponse.json({
      ...page,
      data: page.data.map((j) => ({
        id: j.id,
        estatus: j.estatus,
        servicio: j.servicio_nombre,
        cliente: j.cliente_nombre,
        zona: j.zona ?? '—',
        hora: formatHora(j.fecha_programada),
      })),
    });
  },
});
