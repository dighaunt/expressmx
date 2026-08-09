import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireSession } from '@/lib/auth/mobile';
import { NotFoundError } from '@/lib/errors/http-errors';

export const PATCH = withApiHandler(async (req, { params }) => {
  const session = await requireSession(req);
  const { id } = await params;
  const body = await req.json() as {
    alias?: string;
    referencia?: string;
    predeterminada?: boolean;
  };

  const existing = await queryOne(
    'SELECT id FROM direcciones WHERE id = $1 AND usuario_id = $2',
    [id, session.sub]
  );
  if (!existing) throw new NotFoundError('Dirección no encontrada');

  if (body.predeterminada) {
    await queryOne('UPDATE direcciones SET predeterminada = false WHERE usuario_id = $1', [session.sub]);
  }

  const updated = await queryOne(
    `UPDATE direcciones
     SET alias = COALESCE($1, alias),
         referencia = COALESCE($2, referencia),
         predeterminada = COALESCE($3, predeterminada)
     WHERE id = $4 AND usuario_id = $5
     RETURNING *`,
    [body.alias ?? null, body.referencia ?? null, body.predeterminada ?? null, id, session.sub]
  );

  return NextResponse.json({ data: updated });
}, 'PATCH /api/mobile/addresses/[id]');

export const DELETE = withApiHandler(async (req, { params }) => {
  const session = await requireSession(req);
  const { id } = await params;

  const deleted = await queryOne<{ id: string }>(
    'DELETE FROM direcciones WHERE id = $1 AND usuario_id = $2 RETURNING id',
    [id, session.sub]
  );
  if (!deleted) throw new NotFoundError('Dirección no encontrada');

  return NextResponse.json({ data: { id } });
}, 'DELETE /api/mobile/addresses/[id]');
