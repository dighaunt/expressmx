import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { requireApiPermiso } from '@/lib/api/authz';
import { withApiHandler } from '@/lib/api/handler';
import { NotFoundError } from '@/lib/errors/http-errors';

export const GET = withApiHandler(async (req, { params }) => {
  await requireApiPermiso(req, 'catalogo.ver');
  const { id } = await params;

  const service = await queryOne(
    `SELECT s.*, c.nombre AS categoria_nombre
     FROM servicios s
     JOIN categorias_servicio c ON c.id = s.categoria_id
     WHERE s.id = $1`,
    [id]
  );
  if (!service) throw new NotFoundError('Servicio no encontrado');

  return NextResponse.json({ data: service });
}, 'GET /api/services/[id]');

export const PATCH = withApiHandler(async (req, { params }) => {
  await requireApiPermiso(req, 'catalogo.editar');
  const { id } = await params;
  const body = await req.json() as {
    nombre?: string;
    descripcion?: string;
    precio_base?: number;
    precio_maximo?: number;
    duracion_estimada_min?: number;
    activo?: boolean;
    categoria_id?: string;
  };

  const existing = await queryOne('SELECT id FROM servicios WHERE id = $1', [id]);
  if (!existing) throw new NotFoundError('Servicio no encontrado');

  const updated = await queryOne(
    `UPDATE servicios
     SET nombre = COALESCE($1, nombre),
         descripcion = COALESCE($2, descripcion),
         precio_base = COALESCE($3, precio_base),
         precio_maximo = COALESCE($4, precio_maximo),
         duracion_estimada_min = COALESCE($5, duracion_estimada_min),
         activo = COALESCE($6, activo),
         categoria_id = COALESCE($7::uuid, categoria_id)
     WHERE id = $8
     RETURNING *`,
    [
      body.nombre ?? null,
      body.descripcion ?? null,
      body.precio_base ?? null,
      body.precio_maximo ?? null,
      body.duracion_estimada_min ?? null,
      body.activo ?? null,
      body.categoria_id ?? null,
      id,
    ]
  );

  return NextResponse.json({ data: updated });
}, 'PATCH /api/services/[id]');

export const DELETE = withApiHandler(async (req, { params }) => {
  await requireApiPermiso(req, 'catalogo.editar');
  const { id } = await params;

  const existing = await queryOne('SELECT id FROM servicios WHERE id = $1', [id]);
  if (!existing) throw new NotFoundError('Servicio no encontrado');

  await queryOne('UPDATE servicios SET activo = false WHERE id = $1', [id]);

  return NextResponse.json({ data: { id } });
}, 'DELETE /api/services/[id]');
