import { NextResponse } from 'next/server';
import { withTransaction } from '@expressmx/database';
import { mobileProviderChecklistSchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/errors/http-errors';
import {
  type ChecklistState,
  parseChecklistState,
  serializeChecklistState,
} from '@/lib/provider/job-state';

interface OrderRow {
  id: string;
  prestador_id: string | null;
  estatus: string;
  notas_prestador: string | null;
}

interface CountRow {
  total: number;
}

export const POST = defineEndpoint({
  tag: 'POST /api/v1/mobile/provider/jobs/[id]/checklist',
  auth: { role: ['prestador'] },
  bodySchema: mobileProviderChecklistSchema,
  handler: async ({ params, body, session }) => {
    const orderId = (params as { id: string }).id;
    const userId = session!.sub;
    const paso = body.paso;

    if (paso === 'pin_cliente' || paso === 'pin_prestador') {
      throw new BadRequestError('Estos pasos se completan en sus pantallas dedicadas');
    }

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
      if (order.estatus === 'completada' || order.estatus === 'cancelada') {
        throw new ConflictError('La orden ya está cerrada');
      }

      const state = parseChecklistState(order.notas_prestador);
      if (!state.pin_cliente_validated_at) {
        throw new ConflictError(
          'Primero valida el PIN del cliente para iniciar el servicio',
        );
      }

      if (paso === 'foto_antes' || paso === 'foto_despues') {
        const fase = paso === 'foto_antes' ? 'antes' : 'despues';
        const evid = await tx.queryOne<CountRow>(
          `SELECT COUNT(*)::INT AS total
           FROM evidencias_orden
           WHERE orden_id = $1 AND subida_por = $2 AND fase = $3`,
          [orderId, userId, fase],
        );
        if (!evid || evid.total === 0) {
          throw new ConflictError(
            'Sube al menos una foto antes de marcar este paso como hecho',
          );
        }
      }

      const now = new Date().toISOString();
      const next: ChecklistState = { ...state };
      switch (paso) {
        case 'foto_antes':
          next.foto_antes_done_at = next.foto_antes_done_at ?? now;
          break;
        case 'diagnostico':
          next.diagnostico_done_at = next.diagnostico_done_at ?? now;
          break;
        case 'reparacion':
          next.reparacion_done_at = next.reparacion_done_at ?? now;
          break;
        case 'foto_despues':
          next.foto_despues_done_at = next.foto_despues_done_at ?? now;
          break;
      }

      await tx.query(
        `UPDATE ordenes_servicio SET notas_prestador = $1, updated_at = NOW() WHERE id = $2`,
        [serializeChecklistState(next), orderId],
      );

      return NextResponse.json({ data: { paso, marcado_en: now } });
    });
  },
});
