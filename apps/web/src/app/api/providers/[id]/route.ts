import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireAdminSession } from '@/lib/auth/session';
import { NotFoundError } from '@/lib/errors/http-errors';

export const GET = withApiHandler(async (req, { params }) => {
  await requireAdminSession();
  const { id } = await params;

  const provider = await queryOne(
    `SELECT
       u.id, u.nombre, u.apellidos, u.email, u.telefono,
       u.activo, u.avatar_url, u.curp, u.fecha_nacimiento,
       u.recibe_ordenes, u.motivo_restriccion, u.created_at,
       a.nombre AS agencia_nombre,
       ROUND(AVG(c.puntuacion), 2)::float AS calificacion_promedio,
       COUNT(DISTINCT o.id) FILTER (WHERE o.estatus = 'completada')::int AS ordenes_completadas
     FROM usuarios u
     LEFT JOIN agencias a ON a.id = u.agencia_id
     LEFT JOIN ordenes_servicio o ON o.prestador_id = u.id
     LEFT JOIN calificaciones c ON c.calificado_id = u.id
     WHERE u.id = $1 AND u.rol = 'prestador'
     GROUP BY u.id, a.nombre`,
    [id]
  );
  if (!provider) throw new NotFoundError('Prestador no encontrado');

  const services = await query(
    `SELECT s.id, s.nombre, sp.precio_custom, sp.activo
     FROM servicios_prestador sp
     JOIN servicios s ON s.id = sp.servicio_id
     WHERE sp.prestador_id = $1`,
    [id]
  );

  return NextResponse.json({ data: { ...provider, servicios: services } });
}, 'GET /api/providers/[id]');

export const PATCH = withApiHandler(async (req, { params }) => {
  await requireAdminSession();
  const { id } = await params;
  const body = await req.json() as {
    activo?: boolean;
    recibe_ordenes?: boolean;
    motivo_restriccion?: string;
    agencia_id?: string | null;
  };

  const existing = await queryOne('SELECT id FROM usuarios WHERE id = $1 AND rol = $2', [id, 'prestador']);
  if (!existing) throw new NotFoundError('Prestador no encontrado');

  const updated = await queryOne(
    `UPDATE usuarios
     SET activo = COALESCE($1, activo),
         recibe_ordenes = COALESCE($2, recibe_ordenes),
         motivo_restriccion = COALESCE($3, motivo_restriccion),
         agencia_id = $4,
         updated_at = NOW()
     WHERE id = $5
     RETURNING id, nombre, apellidos, email, activo, recibe_ordenes, motivo_restriccion, agencia_id`,
    [body.activo ?? null, body.recibe_ordenes ?? null, body.motivo_restriccion ?? null, body.agencia_id ?? null, id]
  );

  return NextResponse.json({ data: updated });
}, 'PATCH /api/providers/[id]');
