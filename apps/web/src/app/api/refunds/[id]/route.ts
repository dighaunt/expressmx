import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireAdminSession } from '@/lib/auth/session';
import { NotFoundError, UnprocessableError } from '@/lib/errors/http-errors';

const REFUND_TRANSITIONS: Record<string, string[]> = {
  solicitado: ['aprobado', 'rechazado'],
  aprobado: ['procesado'],
};

export const PATCH = withApiHandler(async (req, { params }) => {
  const session = await requireAdminSession();
  const { id } = await params;
  const body = await req.json() as { estatus?: string; referencia_pasarela?: string };

  const refund = await queryOne<{ id: string; estatus: string }>(
    'SELECT id, estatus FROM reembolsos WHERE id = $1',
    [id]
  );
  if (!refund) throw new NotFoundError('Reembolso no encontrado');

  if (body.estatus) {
    const allowed = REFUND_TRANSITIONS[refund.estatus] ?? [];
    if (!allowed.includes(body.estatus)) {
      throw new UnprocessableError(`No se puede cambiar de '${refund.estatus}' a '${body.estatus}'`);
    }
  }

  const updated = await queryOne(
    `UPDATE reembolsos
     SET estatus = COALESCE($1::estatus_reembolso, estatus),
         referencia_pasarela = COALESCE($2, referencia_pasarela),
         aprobado_por = CASE WHEN $1 IN ('aprobado', 'procesado') THEN $3::uuid ELSE aprobado_por END
     WHERE id = $4
     RETURNING id, estatus, referencia_pasarela`,
    [body.estatus ?? null, body.referencia_pasarela ?? null, session.sub, id]
  );

  return NextResponse.json({ data: updated });
}, 'PATCH /api/refunds/[id]');
