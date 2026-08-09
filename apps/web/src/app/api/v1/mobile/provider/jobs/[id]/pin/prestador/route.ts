import { NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { defineEndpoint } from '@/lib/api/handler';
import { ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors/http-errors';
import { parseChecklistState } from '@/lib/provider/job-state';

interface OrderRow {
  id: string;
  prestador_id: string | null;
  estatus: string;
  pin_prestador: string | null;
  notas_prestador: string | null;
}

export const GET = defineEndpoint({
  tag: 'GET /api/v1/mobile/provider/jobs/[id]/pin/prestador',
  auth: { role: ['prestador'] },
  handler: async ({ params, session }) => {
    const orderId = (params as { id: string }).id;
    const userId = session!.sub;

    const order = await queryOne<OrderRow>(
      `SELECT id, prestador_id, estatus, pin_prestador, notas_prestador
       FROM ordenes_servicio WHERE id = $1`,
      [orderId],
    );

    if (!order) throw new NotFoundError('No encontramos esa orden');
    if (order.prestador_id !== userId) {
      throw new ForbiddenError('Esa orden no está asignada a ti');
    }
    if (order.estatus === 'cancelada') {
      throw new ConflictError('La orden fue cancelada');
    }
    if (!order.pin_prestador) {
      throw new ConflictError('La orden no tiene PIN del prestador configurado');
    }

    const state = parseChecklistState(order.notas_prestador);

    return NextResponse.json({
      data: {
        pin: order.pin_prestador,
        usado: Boolean(state.pin_prestador_confirmed_at),
      },
    });
  },
});
