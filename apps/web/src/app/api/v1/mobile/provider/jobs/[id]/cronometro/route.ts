import { NextResponse } from 'next/server';
import { withTransaction } from '@expressmx/database';
import { mobileProviderCronometroSchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import { ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors/http-errors';
import {
  pauseCronometro,
  parseChecklistState,
  resumeCronometro,
  serializeChecklistState,
} from '@/lib/provider/job-state';

interface OrderRow {
  id: string;
  prestador_id: string | null;
  estatus: string;
  notas_prestador: string | null;
}

export const POST = defineEndpoint({
  tag: 'POST /api/v1/mobile/provider/jobs/[id]/cronometro',
  auth: { role: ['prestador'] },
  bodySchema: mobileProviderCronometroSchema,
  handler: async ({ params, body, session }) => {
    const orderId = (params as { id: string }).id;
    const userId = session!.sub;

    return await withTransaction(async (tx) => {
      const order = await tx.queryOne<OrderRow>(
        `SELECT id, prestador_id, estatus, notas_prestador
         FROM ordenes_servicio WHERE id = $1 FOR UPDATE`,
        [orderId],
      );

      if (!order) throw new NotFoundError('No encontramos esa orden');
      if (order.prestador_id !== userId) {
        throw new ForbiddenError('Esa orden no está asignada a ti');
      }
      if (order.estatus !== 'en_progreso') {
        throw new ConflictError('El cronómetro solo se controla durante un servicio en progreso');
      }

      const state = parseChecklistState(order.notas_prestador);
      const next = body.accion === 'pausar' ? pauseCronometro(state) : resumeCronometro(state);

      await tx.query(
        `UPDATE ordenes_servicio SET notas_prestador = $1, updated_at = NOW() WHERE id = $2`,
        [serializeChecklistState(next), orderId],
      );

      return NextResponse.json({
        data: { corriendo: next.cronometro_running, acumulado_seg: next.cronometro_acumulado_seg },
      });
    });
  },
});
