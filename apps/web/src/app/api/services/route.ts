import { NextResponse } from 'next/server';
import { query, queryOne } from '@expressmx/database';
import { requireApiPermiso } from '@/lib/api/authz';
import { withApiHandler } from '@/lib/api/handler';
import { BadRequestError } from '@/lib/errors/http-errors';

export const GET = withApiHandler(async (req) => {
  await requireApiPermiso(req, 'catalogo.ver');
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const offset = (page - 1) * limit;
  const search = searchParams.get('search')?.trim();
  const categoriaId = searchParams.get('categoria_id');

  const conditions: string[] = [];
  const extraParams: unknown[] = [];
  if (search) {
    extraParams.push(`%${search}%`);
    conditions.push(`(s.nombre ILIKE $${extraParams.length + 2} OR s.descripcion ILIKE $${extraParams.length + 2})`);
  }
  if (categoriaId) {
    extraParams.push(categoriaId);
    conditions.push(`s.categoria_id = $${extraParams.length + 2}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows, countResult] = await Promise.all([
    query(
      `SELECT
         s.id, s.nombre, s.descripcion, s.precio_base, s.precio_maximo,
         s.duracion_estimada_min, s.activo,
         cs.nombre AS categoria_nombre,
         COUNT(DISTINCT sp.prestador_id)::int AS total_prestadores,
         COUNT(DISTINCT o.id)::int AS total_ordenes
       FROM servicios s
       JOIN categorias_servicio cs ON cs.id = s.categoria_id
       LEFT JOIN servicios_prestador sp ON sp.servicio_id = s.id
       LEFT JOIN ordenes_servicio o ON o.servicio_id = s.id
       ${whereClause}
       GROUP BY s.id, cs.nombre
       ORDER BY s.nombre ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset, ...extraParams]
    ),
    query(
      `SELECT COUNT(*) AS total FROM servicios s ${whereClause}`,
      extraParams
    ),
  ]);

  const total = parseInt((countResult[0] as { total: string }).total, 10);

  return NextResponse.json({
    data: rows,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}, 'GET /api/services');

export const POST = withApiHandler(async (req) => {
  await requireApiPermiso(req, 'catalogo.crear');
  const body = await req.json() as {
    categoria_id?: string;
    nombre?: string;
    descripcion?: string;
    precio_base?: number;
    precio_maximo?: number;
    duracion_estimada_min?: number;
    activo?: boolean;
  };

  if (!body.categoria_id || !body.nombre?.trim() || body.precio_base === undefined) {
    throw new BadRequestError('categoria_id, nombre y precio_base son requeridos');
  }

  const categoria = await queryOne<{ id: string }>(
    'SELECT id FROM categorias_servicio WHERE id = $1 AND activa = TRUE',
    [body.categoria_id],
  );
  if (!categoria) throw new BadRequestError('La categoría no existe o está inactiva');

  const created = await queryOne(
    `INSERT INTO servicios (
       categoria_id,
       nombre,
       descripcion,
       precio_base,
       precio_maximo,
       duracion_estimada_min,
       activo
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      body.categoria_id,
      body.nombre.trim(),
      body.descripcion?.trim() || null,
      body.precio_base,
      body.precio_maximo ?? null,
      body.duracion_estimada_min ?? null,
      body.activo ?? true,
    ],
  );

  return NextResponse.json({ data: created }, { status: 201 });
}, 'POST /api/services');
