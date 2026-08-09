import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { BadRequestError } from '@/lib/errors/http-errors';
import { getStaticMapImage } from '@/lib/google-maps/client';

export const GET = withApiHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const latitude = Number(searchParams.get('lat'));
  const longitude = Number(searchParams.get('lng'));
  const width = clamp(Number(searchParams.get('w') ?? 640), 240, 960);
  const height = clamp(Number(searchParams.get('h') ?? 360), 160, 720);
  const zoom = clamp(Number(searchParams.get('z') ?? 15), 8, 18);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new BadRequestError('lat y lng son requeridos');
  }

  const image = await getStaticMapImage({ latitude, longitude, width, height, zoom });
  return new NextResponse(image.bytes, {
    headers: {
      'Content-Type': image.contentType,
      'Cache-Control': 'public, max-age=300',
    },
  });
}, 'GET /api/mobile/google/static-map');

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}
