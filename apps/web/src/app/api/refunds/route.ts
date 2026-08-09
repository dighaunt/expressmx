import { NextResponse } from 'next/server';
import { query } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireAdminSession } from '@/lib/auth/session';
import { BadRequestError } from '@/lib/errors/http-errors';

const ESTATUS_REEMBOLSO = ['solicitado', 'aprobado', 'rechazado', 'procesado'] as const;
type EstatusReembolso = (typeof ESTATUS_REEMBOLSO)[number];

export const GET = withApiHandler(async (req) => {
  await requireAdminSession();
  const { searchParams } = req.nextUrl;
  const estatusParam = searchParams.get('estatus');
  if (estatusParam && !ESTATUS_REEMBOLSO.includes(estatusParam as EstatusReembolso)) {
    throw new BadRequestError(`estatus inválido: ${ESTATUS_REEMBOLSO.join(', ')}`);
  }
  const estatus = estatusParam as EstatusReembolso | null;

  const rows = await query(
    `SELECT r.id, r.monto, r.motivo, r.estatus, r.created_at,
            p.metodo AS metodo_pago, o.id AS orden_id,
            u.nombre AS aprobado_por_nombre
     FROM reembolsos r
     JOIN pagos p ON p.id = r.pago_id
     JOIN ordenes_servicio o ON o.id = p.orden_id
     LEFT JOIN usuarios u ON u.id = r.aprobado_por
     WHERE ($1::estatus_reembolso IS NULL OR r.estatus = $1::estatus_reembolso)
     ORDER BY r.created_at DESC`,
    [estatus]
  );

  return NextResponse.json({ data: rows });
}, 'GET /api/refunds');
