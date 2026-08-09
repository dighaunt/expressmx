import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireAdminSession } from '@/lib/auth/session';
import { NotFoundError } from '@/lib/errors/http-errors';

export const PATCH = withApiHandler(async (req, { params }) => {
  await requireAdminSession();
  const { id } = await params;
  const body = await req.json() as {
    nombre?: string;
    radio_km?: number;
    estatus?: string;
  };

  const existing = await queryOne('SELECT id FROM zonas_cobertura WHERE id = $1', [id]);
  if (!existing) throw new NotFoundError('Zona no encontrada');

  const updated = await queryOne(
    `UPDATE zonas_cobertura
     SET nombre = COALESCE($1, nombre),
         radio_km = COALESCE($2, radio_km),
         estatus = COALESCE($3::estatus_zona, estatus)
     WHERE id = $4
     RETURNING *`,
    [body.nombre ?? null, body.radio_km ?? null, body.estatus ?? null, id]
  );

  return NextResponse.json({ data: updated });
}, 'PATCH /api/zones/[id]');

export const DELETE = withApiHandler(async (req, { params }) => {
  await requireAdminSession();
  const { id } = await params;

  const existing = await queryOne('SELECT id FROM zonas_cobertura WHERE id = $1', [id]);
  if (!existing) throw new NotFoundError('Zona no encontrada');

  await queryOne("UPDATE zonas_cobertura SET estatus = 'suspendida' WHERE id = $1", [id]);

  return NextResponse.json({ data: { id } });
}, 'DELETE /api/zones/[id]');
