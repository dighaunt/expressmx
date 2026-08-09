import { NextRequest, NextResponse } from 'next/server';
import { query } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireAdminSession } from '@/lib/auth/session';

export const GET = withApiHandler(async (req) => {
  await requireAdminSession();
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const offset = (page - 1) * limit;
  const estatus = searchParams.get('estatus');

  const whereClause = estatus ? `WHERE o.estatus = $3::estatus_orden` : '';
  const params: unknown[] = [limit, offset, ...(estatus ? [estatus] : [])];

  const [rows, countResult] = await Promise.all([
    query(
      `SELECT
         o.id, o.estatus, o.fecha_programada, o.monto_total, o.descuento, o.created_at,
         o.notas_cliente, o.notas_prestador,
         s.nombre AS servicio_nombre,
         s.precio_base AS servicio_precio_base,
         c.id AS cliente_id, c.nombre AS cliente_nombre, c.apellidos AS cliente_apellidos, c.email AS cliente_email,
         p.id AS prestador_id, p.nombre AS prestador_nombre, p.apellidos AS prestador_apellidos
       FROM ordenes_servicio o
       JOIN servicios s ON s.id = o.servicio_id
       JOIN usuarios c ON c.id = o.cliente_id
       LEFT JOIN usuarios p ON p.id = o.prestador_id
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    ),
    query(
      `SELECT COUNT(*) AS total FROM ordenes_servicio o ${whereClause}`,
      estatus ? [estatus] : []
    ),
  ]);

  const total = parseInt((countResult[0] as { total: string }).total, 10);

  return NextResponse.json({
    data: rows,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}, 'GET /api/orders');
