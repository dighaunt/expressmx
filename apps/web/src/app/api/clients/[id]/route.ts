import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireAdminSession } from '@/lib/auth/session';
import { NotFoundError, BadRequestError } from '@/lib/errors/http-errors';

export const GET = withApiHandler(async (req, { params }) => {
  await requireAdminSession();
  const { id } = await params;

  const client = await queryOne(
    `SELECT
       u.id, u.nombre, u.apellidos, u.email, u.telefono,
       u.activo, u.avatar_url, u.created_at, u.updated_at,
       u.motivo_restriccion, u.restringido_en,
       COUNT(o.id)::int AS total_ordenes,
       COALESCE(SUM(o.monto_total) FILTER (WHERE o.estatus = 'completada'), 0) AS gasto_total
     FROM usuarios u
     LEFT JOIN ordenes_servicio o ON o.cliente_id = u.id
     WHERE u.id = $1 AND u.rol = 'cliente'
     GROUP BY u.id`,
    [id]
  );
  if (!client) throw new NotFoundError('Cliente no encontrado');

  return NextResponse.json({ data: client });
}, 'GET /api/clients/[id]');

export const PATCH = withApiHandler(async (req, { params }) => {
  await requireAdminSession();
  const { id } = await params;
  const body = await req.json() as { activo?: boolean; motivo_restriccion?: string };

  const existing = await queryOne('SELECT id FROM usuarios WHERE id = $1 AND rol = $2', [id, 'cliente']);
  if (!existing) throw new NotFoundError('Cliente no encontrado');

  const updated = await queryOne(
    `UPDATE usuarios
     SET activo = COALESCE($1, activo),
         motivo_restriccion = $2,
         restringido_en = CASE WHEN $1 = false THEN NOW() ELSE restringido_en END,
         updated_at = NOW()
     WHERE id = $3
     RETURNING id, nombre, apellidos, email, activo, motivo_restriccion`,
    [body.activo ?? null, body.motivo_restriccion ?? null, id]
  );

  return NextResponse.json({ data: updated });
}, 'PATCH /api/clients/[id]');
