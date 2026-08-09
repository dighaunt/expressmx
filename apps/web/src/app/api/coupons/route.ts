import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireAdminSession } from '@/lib/auth/session';
import { BadRequestError } from '@/lib/errors/http-errors';

export const GET = withApiHandler(async (req) => {
  await requireAdminSession();
  const { searchParams } = req.nextUrl;
  const activo = searchParams.get('activo');

  const rows = await query(
    `SELECT id, codigo, tipo_descuento, valor, fecha_inicio, fecha_expiracion,
            usos_maximos, usos_actuales, solo_primera_compra
     FROM cupones
     ${activo !== null ? `WHERE (fecha_expiracion >= CURRENT_DATE) = ${activo === 'true'}` : ''}
     ORDER BY fecha_expiracion DESC`
  );

  return NextResponse.json({ data: rows });
}, 'GET /api/coupons');

export const POST = withApiHandler(async (req) => {
  await requireAdminSession();
  const body = await req.json() as {
    codigo?: string;
    tipo_descuento?: string;
    valor?: number;
    fecha_inicio?: string;
    fecha_expiracion?: string;
    usos_maximos?: number;
    solo_primera_compra?: boolean;
    categoria_id?: string;
  };

  if (!body.codigo || !body.tipo_descuento || body.valor === undefined || !body.fecha_inicio || !body.fecha_expiracion) {
    throw new BadRequestError('codigo, tipo_descuento, valor, fecha_inicio y fecha_expiracion son requeridos');
  }

  const created = await queryOne(
    `INSERT INTO cupones (codigo, tipo_descuento, valor, fecha_inicio, fecha_expiracion, usos_maximos, solo_primera_compra, categoria_id)
     VALUES ($1, $2::tipo_descuento, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      body.codigo.toUpperCase(),
      body.tipo_descuento,
      body.valor,
      body.fecha_inicio,
      body.fecha_expiracion,
      body.usos_maximos ?? 1,
      body.solo_primera_compra ?? false,
      body.categoria_id ?? null,
    ]
  );

  return NextResponse.json({ data: created }, { status: 201 });
}, 'POST /api/coupons');
