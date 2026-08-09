import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireSession } from '@/lib/auth/mobile';

export const GET = withApiHandler(async (req) => {
  const session = await requireSession(req);

  const profile = await queryOne(
    `SELECT id, nombre, apellidos, email, telefono, avatar_url, rol, curp, fecha_nacimiento, activo
     FROM usuarios WHERE id = $1`,
    [session.sub]
  );

  return NextResponse.json({ data: profile });
}, 'GET /api/mobile/profile');

export const PATCH = withApiHandler(async (req) => {
  const session = await requireSession(req);
  const body = await req.json() as {
    nombre?: string;
    apellidos?: string;
    telefono?: string;
    avatar_url?: string;
  };

  const updated = await queryOne(
    `UPDATE usuarios
     SET nombre = COALESCE($1, nombre),
         apellidos = COALESCE($2, apellidos),
         telefono = COALESCE($3, telefono),
         avatar_url = COALESCE($4, avatar_url),
         updated_at = NOW()
     WHERE id = $5
     RETURNING id, nombre, apellidos, email, telefono, avatar_url`,
    [body.nombre ?? null, body.apellidos ?? null, body.telefono ?? null, body.avatar_url ?? null, session.sub]
  );

  return NextResponse.json({ data: updated });
}, 'PATCH /api/mobile/profile');
