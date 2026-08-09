import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireAdminSession } from '@/lib/auth/session';
import { NotFoundError, UnprocessableError } from '@/lib/errors/http-errors';

export const DELETE = withApiHandler(async (req, { params }) => {
  const session = await requireAdminSession();
  const { id } = await params;

  const inv = await queryOne<{ id: string; usado_en: string | null; revocada_en: string | null }>(
    'SELECT id, usado_en, revocada_en FROM invitaciones_prestadores WHERE id = $1',
    [id]
  );
  if (!inv) throw new NotFoundError('Invitación no encontrada');
  if (inv.usado_en) throw new UnprocessableError('La invitación ya fue utilizada');
  if (inv.revocada_en) throw new UnprocessableError('La invitación ya fue revocada');

  await queryOne(
    'UPDATE invitaciones_prestadores SET revocada_en = NOW(), revocada_por = $1 WHERE id = $2',
    [session.sub, id]
  );

  return NextResponse.json({ data: { id } });
}, 'DELETE /api/invitations/[id]');
