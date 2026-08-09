import { NextResponse } from 'next/server';
import { query } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireSession } from '@/lib/auth/mobile';

export const GET = withApiHandler(async (req) => {
  await requireSession(req);

  const rows = await query(
    `SELECT
       id,
       nombre,
       centro_lat,
       centro_lng,
       radio_km,
       poligono_coords IS NOT NULL AS has_polygon
     FROM zonas_cobertura
     WHERE estatus = 'activa'
     ORDER BY nombre ASC`,
  );

  return NextResponse.json({ data: rows });
}, 'GET /api/mobile/coverage/zones');
