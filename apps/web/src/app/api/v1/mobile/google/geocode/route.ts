import { NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireSession } from '@/lib/auth/mobile';
import { BadRequestError, UnprocessableError } from '@/lib/errors/http-errors';
import { forwardGeocode } from '@/lib/google-maps/client';
import { getZoneBbox } from '@/lib/google-maps/zones';

interface ZoneRow {
  id: string;
  nombre: string;
  centro_lat: string;
  centro_lng: string;
  radio_km: string | null;
}

export const POST = withApiHandler(async (req) => {
  await requireSession(req);
  const body = (await req.json()) as {
    query?: string;
    zone_id?: string;
    autocomplete?: boolean;
    limit?: number;
  };

  const search = body.query?.trim();
  if (!search || !body.zone_id) {
    throw new BadRequestError('query y zone_id son requeridos');
  }

  const zone = await queryOne<ZoneRow>(
    `SELECT id, nombre, centro_lat, centro_lng, radio_km
       FROM zonas_cobertura
      WHERE id = $1
        AND estatus = 'activa'
      LIMIT 1`,
    [body.zone_id],
  );
  if (!zone) throw new UnprocessableError('Elige una zona de cobertura disponible');

  const bbox = getZoneBbox(zone);
  const features = await forwardGeocode({
    query: `${search}, ${zone.nombre}, México`,
    autocomplete: body.autocomplete === true,
    ...(typeof body.limit === 'number' ? { limit: body.limit } : {}),
    proximity: {
      latitude: Number(zone.centro_lat),
      longitude: Number(zone.centro_lng),
    },
    ...(bbox ? { bbox } : {}),
  });

  if (features.length === 0 && body.autocomplete === true) {
    return NextResponse.json({ data: [] });
  }

  if (features.length === 0) {
    throw new UnprocessableError('No pudimos ubicar esa dirección con Google Maps');
  }

  return NextResponse.json({ data: features });
}, 'POST /api/mobile/google/geocode');
