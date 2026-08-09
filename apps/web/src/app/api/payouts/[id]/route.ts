import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireAdminSession } from '@/lib/auth/session';
import { NotFoundError, UnprocessableError } from '@/lib/errors/http-errors';

const PAYOUT_TRANSITIONS: Record<string, string[]> = {
  generado: ['revisado'],
  revisado: ['depositado'],
};

export const GET = withApiHandler(async (req, { params }) => {
  await requireAdminSession();
  const { id } = await params;

  const payout = await queryOne(
    `SELECT c.*, u.nombre AS prestador_nombre, u.email AS prestador_email
     FROM cortes_pago c
     JOIN usuarios u ON u.id = c.prestador_id
     WHERE c.id = $1`,
    [id]
  );
  if (!payout) throw new NotFoundError('Corte de pago no encontrado');

  return NextResponse.json({ data: payout });
}, 'GET /api/payouts/[id]');

export const PATCH = withApiHandler(async (req, { params }) => {
  const session = await requireAdminSession();
  const { id } = await params;
  const body = await req.json() as {
    estatus?: string;
    referencia_bancaria?: string;
    fecha_deposito?: string;
  };

  const payout = await queryOne<{ id: string; estatus: string }>(
    'SELECT id, estatus FROM cortes_pago WHERE id = $1',
    [id]
  );
  if (!payout) throw new NotFoundError('Corte de pago no encontrado');

  if (body.estatus) {
    const allowed = PAYOUT_TRANSITIONS[payout.estatus] ?? [];
    if (!allowed.includes(body.estatus)) {
      throw new UnprocessableError(`No se puede cambiar de '${payout.estatus}' a '${body.estatus}'`);
    }
  }

  const updated = await queryOne(
    `UPDATE cortes_pago
     SET estatus = COALESCE($1::estatus_corte, estatus),
         referencia_bancaria = COALESCE($2, referencia_bancaria),
         fecha_deposito = COALESCE($3, fecha_deposito),
         aprobado_por = CASE WHEN $1 = 'depositado' THEN $4::uuid ELSE aprobado_por END
     WHERE id = $5
     RETURNING *`,
    [body.estatus ?? null, body.referencia_bancaria ?? null, body.fecha_deposito ?? null, session.sub, id]
  );

  return NextResponse.json({ data: updated });
}, 'PATCH /api/payouts/[id]');
