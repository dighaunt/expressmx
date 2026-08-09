import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireAdminSession } from '@/lib/auth/session';
import { BadRequestError } from '@/lib/errors/http-errors';

const DESTINO_INTERNO = /^\/[a-z0-9/_?=&.%+-]*$/i;
const DESTINO_DEEP_LINK = /^expressmx:\/\/[a-z0-9/_?=&.%+-]*$/i;

export const GET = withApiHandler(async (req) => {
  await requireAdminSession();

  const rows = await query(
    `SELECT id, titulo, imagen_url, url_destino, fecha_inicio, fecha_fin,
            orden_prioridad, segmento, activo
     FROM banners_promocionales
     ORDER BY orden_prioridad ASC, fecha_inicio DESC`
  );

  return NextResponse.json({ data: rows });
}, 'GET /api/banners');

export const POST = withApiHandler(async (req) => {
  const session = await requireAdminSession();
  const body = await req.json() as {
    titulo?: string;
    imagen_url?: string;
    url_destino?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
    orden_prioridad?: number;
    segmento?: string;
  };

  if (!body.titulo || !body.imagen_url || !body.fecha_inicio || !body.fecha_fin) {
    throw new BadRequestError('titulo, imagen_url, fecha_inicio y fecha_fin son requeridos');
  }
  if (body.url_destino && !esDestinoValido(body.url_destino)) {
    throw new BadRequestError('url_destino debe ser http(s)://, expressmx:// o una ruta interna como /services');
  }

  const created = await queryOne(
    `INSERT INTO banners_promocionales (titulo, imagen_url, url_destino, fecha_inicio, fecha_fin, orden_prioridad, segmento, creado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7::segmento_banner, $8)
     RETURNING *`,
    [
      body.titulo,
      body.imagen_url,
      body.url_destino ?? null,
      body.fecha_inicio,
      body.fecha_fin,
      body.orden_prioridad ?? 0,
      body.segmento ?? 'todos',
      session.sub,
    ]
  );

  return NextResponse.json({ data: created }, { status: 201 });
}, 'POST /api/banners');

function esDestinoValido(destino: string): boolean {
  return /^https?:\/\//.test(destino) || DESTINO_INTERNO.test(destino) || DESTINO_DEEP_LINK.test(destino);
}
