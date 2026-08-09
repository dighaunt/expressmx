import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireAdminSession } from '@/lib/auth/session';

export const GET = withApiHandler(async (req) => {
  await requireAdminSession();
  const { searchParams } = req.nextUrl;
  const solo_disponibles = searchParams.get('disponibles') === 'true';

  const rows = await query(
    `SELECT id, codigo, creado_en, expira_en, usado_en, revocada_en, notas
     FROM invitaciones_prestadores
     ${solo_disponibles ? 'WHERE usado_en IS NULL AND revocada_en IS NULL AND expira_en > NOW()' : ''}
     ORDER BY creado_en DESC`
  );

  return NextResponse.json({ data: rows });
}, 'GET /api/invitations');

export const POST = withApiHandler(async (req) => {
  const session = await requireAdminSession();
  const body = await req.json() as { notas?: string; dias_vigencia?: number };

  const created = await queryOne(
    `INSERT INTO invitaciones_prestadores (codigo, creado_por, expira_en, notas)
     VALUES (
       UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8)),
       $1,
       NOW() + ($2 || ' days')::INTERVAL,
       $3
     )
     RETURNING id, codigo, creado_en, expira_en, notas`,
    [session.sub, body.dias_vigencia ?? 14, body.notas ?? null]
  );

  return NextResponse.json({ data: created }, { status: 201 });
}, 'POST /api/invitations');
