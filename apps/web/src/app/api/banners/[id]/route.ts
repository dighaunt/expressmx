import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireAdminSession } from '@/lib/auth/session';
import { BadRequestError, NotFoundError } from '@/lib/errors/http-errors';

const DESTINO_INTERNO = /^\/[a-z0-9/_?=&.%+-]*$/i;
const DESTINO_DEEP_LINK = /^expressmx:\/\/[a-z0-9/_?=&.%+-]*$/i;

export const PATCH = withApiHandler(async (req, { params }) => {
  await requireAdminSession();
  const { id } = await params;
  const body = await req.json() as {
    titulo?: string;
    url_destino?: string;
    fecha_fin?: string;
    orden_prioridad?: number;
    activo?: boolean;
    segmento?: string;
  };

  const existing = await queryOne('SELECT id FROM banners_promocionales WHERE id = $1', [id]);
  if (!existing) throw new NotFoundError('Banner no encontrado');
  if (body.url_destino && !esDestinoValido(body.url_destino)) {
    throw new BadRequestError('url_destino debe ser http(s)://, expressmx:// o una ruta interna como /services');
  }

  const updated = await queryOne(
    `UPDATE banners_promocionales
     SET titulo = COALESCE($1, titulo),
         url_destino = COALESCE($2, url_destino),
         fecha_fin = COALESCE($3, fecha_fin),
         orden_prioridad = COALESCE($4, orden_prioridad),
         activo = COALESCE($5, activo),
         segmento = COALESCE($6::segmento_banner, segmento)
     WHERE id = $7
     RETURNING *`,
    [body.titulo ?? null, body.url_destino ?? null, body.fecha_fin ?? null, body.orden_prioridad ?? null, body.activo ?? null, body.segmento ?? null, id]
  );

  return NextResponse.json({ data: updated });
}, 'PATCH /api/banners/[id]');

export const DELETE = withApiHandler(async (req, { params }) => {
  await requireAdminSession();
  const { id } = await params;

  const existing = await queryOne('SELECT id FROM banners_promocionales WHERE id = $1', [id]);
  if (!existing) throw new NotFoundError('Banner no encontrado');

  await queryOne('DELETE FROM banners_promocionales WHERE id = $1', [id]);

  return NextResponse.json({ data: { id } });
}, 'DELETE /api/banners/[id]');

function esDestinoValido(destino: string): boolean {
  return /^https?:\/\//.test(destino) || DESTINO_INTERNO.test(destino) || DESTINO_DEEP_LINK.test(destino);
}
