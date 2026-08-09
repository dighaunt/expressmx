import { NextResponse } from 'next/server';
import { query } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireAdminSession } from '@/lib/auth/session';
import { BadRequestError } from '@/lib/errors/http-errors';

const ESTATUS_CORTE = ['generado', 'revisado', 'depositado'] as const;
type EstatusCorte = (typeof ESTATUS_CORTE)[number];

export const GET = withApiHandler(async (req) => {
  await requireAdminSession();
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const offset = (page - 1) * limit;
  const estatusParam = searchParams.get('estatus');
  if (estatusParam && !ESTATUS_CORTE.includes(estatusParam as EstatusCorte)) {
    throw new BadRequestError(`estatus inválido: ${ESTATUS_CORTE.join(', ')}`);
  }
  const estatus = estatusParam as EstatusCorte | null;

  const rows = await query(
    `SELECT
       c.id, c.prestador_id, c.fecha_corte, c.fecha_deposito,
       c.monto_total, c.num_transacciones, c.estatus, c.referencia_bancaria,
       u.nombre AS prestador_nombre, u.email AS prestador_email
     FROM cortes_pago c
     JOIN usuarios u ON u.id = c.prestador_id
     WHERE ($3::estatus_corte IS NULL OR c.estatus = $3::estatus_corte)
     ORDER BY c.fecha_corte DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset, estatus]
  );

  return NextResponse.json({ data: rows });
}, 'GET /api/payouts');
