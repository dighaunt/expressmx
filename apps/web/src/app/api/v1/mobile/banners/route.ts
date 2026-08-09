import { NextResponse } from 'next/server';
import { query, queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireSession } from '@/lib/auth/mobile';

interface ClienteSegmento {
  ordenes_completadas: number;
}

interface BannerMobile {
  id: string;
  titulo: string;
  imagen_url: string;
  url_destino: string | null;
  segmento: 'todos' | 'nuevos' | 'recurrentes';
}

export const GET = withApiHandler(async (req) => {
  const session = await requireSession(req);

  const segmento = await queryOne<ClienteSegmento>(
    `SELECT COUNT(*)::INT AS ordenes_completadas
     FROM ordenes_servicio
     WHERE cliente_id = $1 AND estatus = 'completada'`,
    [session.sub],
  );

  const esRecurrente = Number(segmento?.ordenes_completadas ?? 0) > 0;
  const rows = await query<BannerMobile>(
    `SELECT id, titulo, imagen_url, url_destino, segmento
     FROM banners_promocionales
     WHERE activo = TRUE
       AND fecha_inicio <= CURRENT_DATE
       AND fecha_fin >= CURRENT_DATE
       AND (
         segmento = 'todos'
         OR (segmento = 'nuevos' AND $1 = FALSE)
         OR (segmento = 'recurrentes' AND $1 = TRUE)
       )
     ORDER BY orden_prioridad ASC, fecha_fin ASC
     LIMIT 12`,
    [esRecurrente],
  );

  return NextResponse.json({ data: rows });
}, 'GET /api/v1/mobile/banners');
