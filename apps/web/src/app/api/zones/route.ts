import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireAdminSession } from '@/lib/auth/session';
import { BadRequestError } from '@/lib/errors/http-errors';

export const GET = withApiHandler(async () => {
  await requireAdminSession();

  const rows = await query(
    'SELECT id, nombre, centro_lat, centro_lng, radio_km, estatus FROM zonas_cobertura ORDER BY nombre ASC'
  );

  return NextResponse.json({ data: rows });
}, 'GET /api/zones');

export const POST = withApiHandler(async (req) => {
  await requireAdminSession();
  const body = await req.json() as {
    nombre?: string;
    centro_lat?: number;
    centro_lng?: number;
    radio_km?: number;
    poligono_coords?: object;
  };

  if (!body.nombre || body.centro_lat === undefined || body.centro_lng === undefined) {
    throw new BadRequestError('nombre, centro_lat y centro_lng son requeridos');
  }

  const created = await queryOne(
    `INSERT INTO zonas_cobertura (nombre, centro_lat, centro_lng, radio_km, poligono_coords)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [body.nombre, body.centro_lat, body.centro_lng, body.radio_km ?? null, body.poligono_coords ? JSON.stringify(body.poligono_coords) : null]
  );

  return NextResponse.json({ data: created }, { status: 201 });
}, 'POST /api/zones');
