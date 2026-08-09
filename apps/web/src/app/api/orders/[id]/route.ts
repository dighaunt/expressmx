import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireAdminSession } from '@/lib/auth/session';
import { NotFoundError, UnprocessableError, BadRequestError } from '@/lib/errors/http-errors';
import { getAssignmentBlocker } from '@/lib/provider/assignment';

const ADMIN_TRANSITIONS: Record<string, string[]> = {
  solicitada: ['asignada', 'cancelada'],
  asignada: ['en_camino', 'cancelada'],
  en_camino: ['en_progreso', 'cancelada'],
  en_progreso: ['completada', 'cancelada'],
};

export const GET = withApiHandler(async (req, { params }) => {
  await requireAdminSession();
  const { id } = await params;

  const order = await queryOne(
    `SELECT
       o.*,
       s.nombre AS servicio_nombre,
       uc.nombre AS cliente_nombre, uc.email AS cliente_email, uc.telefono AS cliente_telefono,
       up.nombre AS prestador_nombre, up.email AS prestador_email,
       d.calle, d.numero_ext, d.colonia, d.ciudad, d.estado,
       p.metodo AS metodo_pago, p.estatus AS estatus_pago
     FROM ordenes_servicio o
     JOIN servicios s ON s.id = o.servicio_id
     JOIN usuarios uc ON uc.id = o.cliente_id
     LEFT JOIN usuarios up ON up.id = o.prestador_id
     JOIN direcciones d ON d.id = o.direccion_id
     LEFT JOIN pagos p ON p.orden_id = o.id
     WHERE o.id = $1`,
    [id]
  );
  if (!order) throw new NotFoundError('Orden no encontrada');

  return NextResponse.json({ data: order });
}, 'GET /api/orders/[id]');

export const PATCH = withApiHandler(async (req, { params }) => {
  const session = await requireAdminSession();
  const { id } = await params;
  const body = await req.json() as { estatus?: string; prestador_id?: string; notas?: string };
  if (!id) throw new BadRequestError('Identificador inválido');

  const order = await queryOne<{ id: string; estatus: string }>(
    'SELECT id, estatus FROM ordenes_servicio WHERE id = $1',
    [id]
  );
  if (!order) throw new NotFoundError('Orden no encontrada');

  if (body.estatus) {
    const allowed = ADMIN_TRANSITIONS[order.estatus] ?? [];
    if (!allowed.includes(body.estatus)) {
      throw new UnprocessableError(`No se puede cambiar de '${order.estatus}' a '${body.estatus}'`);
    }
  }

  if (body.prestador_id) {
    const blocker = await getAssignmentBlocker({ queryOne }, id, body.prestador_id);
    if (blocker) throw new UnprocessableError(blocker);
  }

  const updated = await queryOne(
    `UPDATE ordenes_servicio
     SET estatus = COALESCE($1::estatus_orden, estatus),
         prestador_id = COALESCE($2::uuid, prestador_id),
         notas_prestador = COALESCE($3, notas_prestador),
         updated_at = NOW()
     WHERE id = $4
     RETURNING id, estatus, prestador_id, notas_prestador`,
    [body.estatus ?? null, body.prestador_id ?? null, body.notas ?? null, id]
  );

  if (body.estatus) {
    await queryOne(
      `INSERT INTO historial_estatus_orden (orden_id, estatus_anterior, estatus_nuevo, cambiado_por)
       VALUES ($1, $2::estatus_orden, $3::estatus_orden, $4)`,
      [id, order.estatus, body.estatus, session.sub]
    );
  }

  return NextResponse.json({ data: updated });
}, 'PATCH /api/orders/[id]');
