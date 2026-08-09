import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireSession } from '@/lib/auth/mobile';
import { BadRequestError, NotFoundError, ConflictError } from '@/lib/errors/http-errors';

export const POST = withApiHandler(async (req) => {
  const session = await requireSession(req);
  const body = await req.json() as {
    orden_id?: string;
    puntuacion?: number;
    comentario?: string;
  };

  if (!body.orden_id || body.puntuacion === undefined) {
    throw new BadRequestError('orden_id y puntuacion son requeridos');
  }
  if (body.puntuacion < 1 || body.puntuacion > 5) {
    throw new BadRequestError('puntuacion debe estar entre 1 y 5');
  }

  const order = await queryOne<{ id: string; estatus: string; cliente_id: string; prestador_id: string }>(
    'SELECT id, estatus, cliente_id, prestador_id FROM ordenes_servicio WHERE id = $1',
    [body.orden_id]
  );
  if (!order) throw new NotFoundError('Orden no encontrada');
  if (order.estatus !== 'completada') {
    throw new BadRequestError('Solo se pueden calificar órdenes completadas');
  }

  const isCliente = order.cliente_id === session.sub;
  const isPrestador = order.prestador_id === session.sub;
  if (!isCliente && !isPrestador) throw new NotFoundError('Orden no encontrada');

  const calificado_id = isCliente ? order.prestador_id : order.cliente_id;

  const existing = await queryOne(
    'SELECT id FROM calificaciones WHERE orden_id = $1 AND calificador_id = $2',
    [body.orden_id, session.sub]
  );
  if (existing) throw new ConflictError('Ya calificaste esta orden');

  const rating = await queryOne(
    `INSERT INTO calificaciones (orden_id, calificador_id, calificado_id, puntuacion, comentario)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, puntuacion, comentario, created_at`,
    [body.orden_id, session.sub, calificado_id, body.puntuacion, body.comentario ?? null]
  );

  return NextResponse.json({ data: rating }, { status: 201 });
}, 'POST /api/mobile/ratings');
