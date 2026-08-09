import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireAdminSession } from '@/lib/auth/session';
import { NotFoundError } from '@/lib/errors/http-errors';

export const GET = withApiHandler(async (req, { params }) => {
  await requireAdminSession();
  const { id } = await params;

  const coupon = await queryOne('SELECT * FROM cupones WHERE id = $1', [id]);
  if (!coupon) throw new NotFoundError('Cupón no encontrado');

  return NextResponse.json({ data: coupon });
}, 'GET /api/coupons/[id]');

export const PATCH = withApiHandler(async (req, { params }) => {
  await requireAdminSession();
  const { id } = await params;
  const body = await req.json() as {
    fecha_expiracion?: string;
    usos_maximos?: number;
    activo?: boolean;
  };

  const existing = await queryOne('SELECT id FROM cupones WHERE id = $1', [id]);
  if (!existing) throw new NotFoundError('Cupón no encontrado');

  const updated = await queryOne(
    `UPDATE cupones
     SET fecha_expiracion = COALESCE($1, fecha_expiracion),
         usos_maximos = COALESCE($2, usos_maximos)
     WHERE id = $3
     RETURNING *`,
    [body.fecha_expiracion ?? null, body.usos_maximos ?? null, id]
  );

  return NextResponse.json({ data: updated });
}, 'PATCH /api/coupons/[id]');

export const DELETE = withApiHandler(async (req, { params }) => {
  await requireAdminSession();
  const { id } = await params;

  const existing = await queryOne('SELECT id FROM cupones WHERE id = $1', [id]);
  if (!existing) throw new NotFoundError('Cupón no encontrado');

  await queryOne('DELETE FROM cupones WHERE id = $1', [id]);

  return NextResponse.json({ data: { id } });
}, 'DELETE /api/coupons/[id]');
