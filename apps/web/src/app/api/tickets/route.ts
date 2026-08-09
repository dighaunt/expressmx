import { NextRequest, NextResponse } from 'next/server';
import { query } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireAdminSession } from '@/lib/auth/session';
import { BadRequestError } from '@/lib/errors/http-errors';

const ESTATUS_VALIDOS = new Set(['abierto', 'en_revision', 'resuelto', 'cerrado', 'escalado']);
const PRIORIDADES_VALIDAS = new Set(['baja', 'media', 'alta', 'urgente']);

export const GET = withApiHandler(async (req) => {
  await requireAdminSession();
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const offset = (page - 1) * limit;
  const estatus = searchParams.get('estatus');
  const prioridad = searchParams.get('prioridad');

  const conditions: string[] = [];
  const params: unknown[] = [limit, offset];
  if (estatus) {
    if (!ESTATUS_VALIDOS.has(estatus)) throw new BadRequestError('estatus inválido');
    params.push(estatus);
    conditions.push(`t.estatus = $${params.length}::estatus_ticket`);
  }
  if (prioridad) {
    if (!PRIORIDADES_VALIDAS.has(prioridad)) throw new BadRequestError('prioridad inválida');
    params.push(prioridad);
    conditions.push(`t.prioridad = $${params.length}::prioridad_ticket`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query(
    `SELECT
       t.id, t.categoria, t.prioridad, t.estatus, t.asunto, t.created_at,
       u.nombre AS usuario_nombre, u.email AS usuario_email,
       a.nombre AS agente_nombre
     FROM tickets_soporte t
     JOIN usuarios u ON u.id = t.usuario_id
     LEFT JOIN usuarios a ON a.id = t.agente_id
     ${where}
     ORDER BY t.prioridad DESC, t.created_at ASC
     LIMIT $1 OFFSET $2`,
    params
  );

  return NextResponse.json({ data: rows });
}, 'GET /api/tickets');
