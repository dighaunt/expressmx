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
  const search = searchParams.get('search')?.trim();

  const whereClause = search
    ? `WHERE u.rol = 'cliente' AND (u.nombre ILIKE $3 OR u.apellidos ILIKE $3 OR u.email ILIKE $3)`
    : `WHERE u.rol = 'cliente'`;
  const params: unknown[] = [limit, offset, ...(search ? [`%${search}%`] : [])];

  const [rows, countResult] = await Promise.all([
    query(
      `SELECT
         u.id, u.nombre, u.apellidos, u.email, u.telefono,
         u.activo, u.created_at, u.avatar_url,
         COUNT(o.id)::int AS total_ordenes
       FROM usuarios u
       LEFT JOIN ordenes_servicio o ON o.cliente_id = u.id
       ${whereClause}
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    ),
    query(
      `SELECT COUNT(*) AS total FROM usuarios u ${whereClause}`,
      search ? [`%${search}%`] : []
    ),
  ]);

  const total = parseInt((countResult[0] as { total: string }).total, 10);

  return NextResponse.json({
    data: rows,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}, 'GET /api/clients');
