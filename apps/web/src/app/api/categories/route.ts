import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@expressmx/database';
import { requireApiPermiso } from '@/lib/api/authz';
import { withApiHandler } from '@/lib/api/handler';
import { BadRequestError } from '@/lib/errors/http-errors';

export const GET = withApiHandler(async (req) => {
  await requireApiPermiso(req, 'catalogo.ver');

  const rows = await query(
    'SELECT id, nombre, descripcion, icono_url, orden_despliegue, activa FROM categorias_servicio ORDER BY orden_despliegue ASC'
  );

  return NextResponse.json({ data: rows });
}, 'GET /api/categories');

export const POST = withApiHandler(async (req) => {
  await requireApiPermiso(req, 'catalogo.gestionar');
  const body = await req.json() as {
    nombre?: string;
    descripcion?: string;
    icono_url?: string;
    orden_despliegue?: number;
  };

  if (!body.nombre) throw new BadRequestError('nombre es requerido');

  const created = await queryOne(
    `INSERT INTO categorias_servicio (nombre, descripcion, icono_url, orden_despliegue)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [body.nombre, body.descripcion ?? null, body.icono_url ?? null, body.orden_despliegue ?? 0]
  );

  return NextResponse.json({ data: created }, { status: 201 });
}, 'POST /api/categories');
