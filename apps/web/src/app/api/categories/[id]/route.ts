import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { requireApiPermiso } from '@/lib/api/authz';
import { withApiHandler } from '@/lib/api/handler';
import { NotFoundError } from '@/lib/errors/http-errors';

export const GET = withApiHandler(async (req, { params }) => {
  await requireApiPermiso(req, 'catalogo.ver');
  const { id } = await params;

  const cat = await queryOne('SELECT * FROM categorias_servicio WHERE id = $1', [id]);
  if (!cat) throw new NotFoundError('Categoría no encontrada');

  return NextResponse.json({ data: cat });
}, 'GET /api/categories/[id]');

export const PATCH = withApiHandler(async (req, { params }) => {
  await requireApiPermiso(req, 'catalogo.gestionar');
  const { id } = await params;
  const body = await req.json() as {
    nombre?: string;
    descripcion?: string;
    icono_url?: string;
    orden_despliegue?: number;
    activa?: boolean;
  };

  const existing = await queryOne('SELECT id FROM categorias_servicio WHERE id = $1', [id]);
  if (!existing) throw new NotFoundError('Categoría no encontrada');

  const updated = await queryOne(
    `UPDATE categorias_servicio
     SET nombre = COALESCE($1, nombre),
         descripcion = COALESCE($2, descripcion),
         icono_url = COALESCE($3, icono_url),
         orden_despliegue = COALESCE($4, orden_despliegue),
         activa = COALESCE($5, activa)
     WHERE id = $6
     RETURNING *`,
    [body.nombre ?? null, body.descripcion ?? null, body.icono_url ?? null, body.orden_despliegue ?? null, body.activa ?? null, id]
  );

  return NextResponse.json({ data: updated });
}, 'PATCH /api/categories/[id]');

export const DELETE = withApiHandler(async (req, { params }) => {
  await requireApiPermiso(req, 'catalogo.gestionar');
  const { id } = await params;

  const existing = await queryOne('SELECT id FROM categorias_servicio WHERE id = $1', [id]);
  if (!existing) throw new NotFoundError('Categoría no encontrada');

  await queryOne('UPDATE categorias_servicio SET activa = false WHERE id = $1', [id]);

  return NextResponse.json({ data: { id } });
}, 'DELETE /api/categories/[id]');
