import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireAdminSession } from '@/lib/auth/session';
import { NotFoundError, UnprocessableError } from '@/lib/errors/http-errors';

const TICKET_TRANSITIONS: Record<string, string[]> = {
  abierto: ['en_revision', 'resuelto'],
  en_revision: ['resuelto', 'escalado'],
  escalado: ['en_revision', 'resuelto'],
};

export const GET = withApiHandler(async (req, { params }) => {
  await requireAdminSession();
  const { id } = await params;

  const ticket = await queryOne(
    `SELECT t.*, u.nombre AS usuario_nombre, u.email AS usuario_email,
            a.nombre AS agente_nombre
     FROM tickets_soporte t
     JOIN usuarios u ON u.id = t.usuario_id
     LEFT JOIN usuarios a ON a.id = t.agente_id
     WHERE t.id = $1`,
    [id]
  );
  if (!ticket) throw new NotFoundError('Ticket no encontrado');

  return NextResponse.json({ data: ticket });
}, 'GET /api/tickets/[id]');

export const PATCH = withApiHandler(async (req, { params }) => {
  const session = await requireAdminSession();
  const { id } = await params;
  const body = await req.json() as {
    estatus?: string;
    prioridad?: string;
    agente_id?: string;
  };

  const ticket = await queryOne<{ id: string; estatus: string }>(
    'SELECT id, estatus FROM tickets_soporte WHERE id = $1',
    [id]
  );
  if (!ticket) throw new NotFoundError('Ticket no encontrado');

  if (body.estatus) {
    const allowed = TICKET_TRANSITIONS[ticket.estatus] ?? [];
    if (!allowed.includes(body.estatus)) {
      throw new UnprocessableError(`No se puede cambiar de '${ticket.estatus}' a '${body.estatus}'`);
    }
  }

  const updated = await queryOne(
    `UPDATE tickets_soporte
     SET estatus = COALESCE($1::estatus_ticket, estatus),
         prioridad = COALESCE($2::prioridad_ticket, prioridad),
         agente_id = COALESCE($3::uuid, agente_id),
         updated_at = NOW()
     WHERE id = $4
     RETURNING id, estatus, prioridad, agente_id`,
    [body.estatus ?? null, body.prioridad ?? null, body.agente_id ?? null, id]
  );

  return NextResponse.json({ data: updated });
}, 'PATCH /api/tickets/[id]');
