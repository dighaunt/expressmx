import { NextResponse } from 'next/server';
import { withTransaction } from '@expressmx/database';
import { defineEndpoint } from '@/lib/api/handler';
import { ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors/http-errors';
import {
  freezeCronometroForCompletion,
  parseChecklistState,
  serializeChecklistState,
} from '@/lib/provider/job-state';

interface OrderRow {
  id: string;
  prestador_id: string | null;
  estatus: string;
  notas_prestador: string | null;
}

export const POST = defineEndpoint({
  tag: 'POST /api/v1/mobile/provider/jobs/[id]/complete',
  auth: { role: ['prestador'] },
  handler: async ({ params, session }) => {
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
      if (order.estatus === 'completada') {
        return NextResponse.json({ data: { ya_completada: true } });
      }
      if (order.estatus === 'cancelada') {
        throw new ConflictError('La orden fue cancelada, no se puede completar');
      }

      const state = parseChecklistState(order.notas_prestador);

      const requiredSteps: Array<keyof typeof state> = [
        'pin_cliente_validated_at',
        'foto_antes_done_at',
        'diagnostico_done_at',
        'reparacion_done_at',
        'foto_despues_done_at',
        'pin_prestador_confirmed_at',
      ];
      const missing = requiredSteps.filter((s) => !state[s]);
      if (missing.length > 0) {
        throw new ConflictError(
          'No puedes finalizar todavía: faltan pasos del checklist',
        );
      }

      const frozen = freezeCronometroForCompletion(state);

      await tx.query(
        `UPDATE ordenes_servicio
         SET estatus = 'completada',
             notas_prestador = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [serializeChecklistState(frozen), orderId],
      );

      await tx.query(
        `INSERT INTO historial_estatus_orden (orden_id, estatus_anterior, estatus_nuevo, cambiado_por, nota)
         VALUES ($1, $2, 'completada', $3, 'Servicio completado por el prestador')`,
        [orderId, order.estatus, userId],
      );

      return NextResponse.json({ data: { completada: true, segundos: frozen.cronometro_acumulado_seg } });
    });
  },
});
