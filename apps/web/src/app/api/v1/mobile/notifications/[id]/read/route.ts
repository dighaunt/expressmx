import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireSession } from '@/lib/auth/mobile';
import { NotFoundError } from '@/lib/errors/http-errors';

export const PATCH = withApiHandler(async (req, { params }) => {
  const session = await requireSession(req);
  const { id } = await params;

  const updated = await queryOne(
    'UPDATE notificaciones SET leida = true WHERE id = $1 AND usuario_id = $2 RETURNING id, leida',
    [id, session.sub]
  );
  if (!updated) throw new NotFoundError('Notificación no encontrada');

  return NextResponse.json({ data: updated });
}, 'PATCH /api/mobile/notifications/[id]/read');
