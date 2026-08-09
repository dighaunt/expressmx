import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireAdminSession } from '@/lib/auth/session';
import { NotFoundError, BadRequestError } from '@/lib/errors/http-errors';

export const GET = withApiHandler(async (req, { params }) => {
  await requireAdminSession();
  const { id } = await params;

  const exists = await queryOne('SELECT id FROM tickets_soporte WHERE id = $1', [id]);
  if (!exists) throw new NotFoundError('Ticket no encontrado');

  const messages = await query(
    `SELECT m.id, m.tipo_autor, m.contenido, m.adjunto_url, m.created_at,
            u.nombre AS autor_nombre
     FROM mensajes_ticket m
     JOIN usuarios u ON u.id = m.autor_id
     WHERE m.ticket_id = $1
     ORDER BY m.created_at ASC`,
    [id]
  );

  return NextResponse.json({ data: messages });
}, 'GET /api/tickets/[id]/messages');

export const POST = withApiHandler(async (req, { params }) => {
  const session = await requireAdminSession();
  const { id } = await params;
  const body = await req.json() as { contenido?: string; adjunto_url?: string };

  if (!body.contenido?.trim()) throw new BadRequestError('contenido es requerido');

  const exists = await queryOne('SELECT id FROM tickets_soporte WHERE id = $1', [id]);
  if (!exists) throw new NotFoundError('Ticket no encontrado');

  const message = await queryOne(
    `INSERT INTO mensajes_ticket (ticket_id, autor_id, tipo_autor, contenido, adjunto_url)
     VALUES ($1, $2, 'agente', $3, $4)
     RETURNING id, tipo_autor, contenido, created_at`,
    [id, session.sub, body.contenido, body.adjunto_url ?? null]
  );

  return NextResponse.json({ data: message }, { status: 201 });
}, 'POST /api/tickets/[id]/messages');
