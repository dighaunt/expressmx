import { NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireSession } from '@/lib/auth/mobile';
import { BadRequestError, UnprocessableError } from '@/lib/errors/http-errors';
import { reverseGeocode } from '@/lib/google-maps/client';

interface ZonePoint {
  zona_id: string;
  zona_nombre: string;
}

export const POST = withApiHandler(async (req) => {
  await requireSession(req);
  const body = (await req.json()) as {
    zone_id?: string;
    latitude?: number;
    longitude?: number;
  };

  const latitude = body.latitude;
  const longitude = body.longitude;

  if (
    !body.zone_id ||
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new BadRequestError('zone_id, latitude y longitude son requeridos');
  }

  const coverage = await queryOne<ZonePoint>(
    'SELECT zona_id, zona_nombre FROM public.zona_operativa_para_punto($1, $2) LIMIT 1',
    [latitude, longitude],
  );
  if (!coverage) {
    throw new UnprocessableError('Este punto está fuera de las zonas disponibles');
  }
  if (coverage.zona_id !== body.zone_id) {
    throw new UnprocessableError(
      `Este punto corresponde a ${coverage.zona_nombre}, selecciona esa zona para continuar`,
    );
  }

  const features = await reverseGeocode({
    latitude,
    longitude,
  });

  if (features.length === 0) {
    throw new UnprocessableError('No pudimos resolver la dirección de ese punto');
  }

  return NextResponse.json({ data: features });
}, 'POST /api/mobile/google/reverse-geocode');
