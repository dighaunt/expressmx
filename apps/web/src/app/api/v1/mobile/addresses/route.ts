import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireSession } from '@/lib/auth/mobile';
import { BadRequestError, UnprocessableError } from '@/lib/errors/http-errors';

interface CoveragePoint {
  zona_id: string;
  zona_nombre: string;
}

export const GET = withApiHandler(async (req) => {
  const session = await requireSession(req);

  const rows = await query(
    `SELECT id, alias, calle, numero_ext, numero_int, colonia, cp, ciudad, estado,
            latitud, longitud, referencia, predeterminada,
            z.zona_id
     FROM direcciones d
     LEFT JOIN LATERAL public.zona_operativa_para_punto(d.latitud, d.longitud) z ON true
     WHERE usuario_id = $1
     ORDER BY predeterminada DESC, id ASC`,
    [session.sub]
  );

  return NextResponse.json({ data: rows });
}, 'GET /api/mobile/addresses');

export const POST = withApiHandler(async (req) => {
  const session = await requireSession(req);
  const body = await req.json() as {
    alias?: string;
    calle?: string;
    numero_ext?: string;
    numero_int?: string;
    colonia?: string;
    cp?: string;
    ciudad?: string;
    estado?: string;
    latitud?: number;
    longitud?: number;
    zona_id?: string;
    referencia?: string;
    predeterminada?: boolean;
  };

  if (!body.calle || !body.numero_ext || !body.colonia || !body.cp || !body.ciudad || !body.estado) {
    throw new BadRequestError('calle, numero_ext, colonia, cp, ciudad y estado son requeridos');
  }
  if (!body.zona_id) {
    throw new UnprocessableError('Elige una zona de cobertura disponible');
  }
  if (!Number.isFinite(body.latitud) || !Number.isFinite(body.longitud)) {
    throw new UnprocessableError('No pudimos ubicar esa dirección. Verifica calle, colonia y código postal.');
  }

  const coverage = await queryOne<CoveragePoint>(
    'SELECT zona_id, zona_nombre FROM public.zona_operativa_para_punto($1, $2) LIMIT 1',
    [body.latitud, body.longitud],
  );
  if (!coverage) {
    throw new UnprocessableError('Esta dirección está fuera de las zonas disponibles');
  }
  if (coverage.zona_id !== body.zona_id) {
    throw new UnprocessableError(
      `La dirección corresponde a ${coverage.zona_nombre}, selecciona esa zona para continuar`
    );
  }

  if (body.predeterminada) {
    await queryOne(
      'UPDATE direcciones SET predeterminada = false WHERE usuario_id = $1',
      [session.sub]
    );
  }

  const created = await queryOne(
    `INSERT INTO direcciones (usuario_id, alias, calle, numero_ext, numero_int, colonia, cp, ciudad, estado, latitud, longitud, referencia, predeterminada)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      session.sub,
      body.alias ?? null,
      body.calle,
      body.numero_ext,
      body.numero_int ?? null,
      body.colonia,
      body.cp,
      body.ciudad,
      body.estado,
      body.latitud ?? null,
      body.longitud ?? null,
      body.referencia ?? null,
      body.predeterminada ?? false,
    ]
  );

  return NextResponse.json({ data: created }, { status: 201 });
}, 'POST /api/mobile/addresses');
