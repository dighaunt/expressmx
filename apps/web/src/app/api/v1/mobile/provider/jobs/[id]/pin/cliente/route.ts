import { NextResponse } from 'next/server';
import { withTransaction } from '@expressmx/database';
import { mobileProviderPinClienteSchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '@/lib/errors/http-errors';
import {
  parseChecklistState,
  resumeCronometro,
  serializeChecklistState,
} from '@/lib/provider/job-state';

const MAX_INTENTOS = 5;

interface OrderRow {
  id: string;
  prestador_id: string | null;
  estatus: string;
  pin_cliente: string | null;
  notas_prestador: string | null;
}

export const POST = defineEndpoint({
  tag: 'POST /api/v1/mobile/provider/jobs/[id]/pin/cliente',
  auth: { role: ['prestador'] },
  bodySchema: mobileProviderPinClienteSchema,
  handler: async ({ params, body, session }) => {
    const orderId = (params as { id: string }).id;
    const userId = session!.sub;

    return await withTransaction(async (tx) => {
      const order = await tx.queryOne<OrderRow>(
        `SELECT id, prestador_id, estatus, pin_cliente, notas_prestador
         FROM ordenes_servicio
         WHERE id = $1
         FOR UPDATE`,
        [orderId],
      );

      if (!order) throw new NotFoundError('No encontramos esa orden');
      if (order.prestador_id !== userId) {
        throw new ForbiddenError('Esa orden no está asignada a ti');
      }
      if (order.estatus === 'completada' || order.estatus === 'cancelada') {
        throw new ConflictError('Esa orden ya está cerrada');
      }
      if (!order.pin_cliente) {
        throw new ConflictError('La orden no tiene PIN configurado');
      }

      const state = parseChecklistState(order.notas_prestador);

      if (state.pin_cliente_validated_at) {
        return NextResponse.json({ data: { ya_validado: true } });
      }

      if (state.pin_cliente_intentos >= MAX_INTENTOS) {
        throw new ConflictError(
          'Demasiados intentos fallidos. Llama a soporte para revisar el PIN con el cliente.',
        );
      }

      if (body.pin !== order.pin_cliente) {
        const updatedState = serializeChecklistState({
          ...state,
          pin_cliente_intentos: state.pin_cliente_intentos + 1,
        });
        await tx.query(
          `UPDATE ordenes_servicio SET notas_prestador = $1 WHERE id = $2`,
          [updatedState, orderId],
        );
        throw new BadRequestError('El PIN no coincide. Pídeselo de nuevo al cliente.');
      }

      const now = new Date().toISOString();
      const next = resumeCronometro({
        ...state,
        pin_cliente_validated_at: now,
        pin_cliente_intentos: 0,
      });

      await tx.query(
        `UPDATE ordenes_servicio
         SET estatus = 'en_progreso',
             notas_prestador = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [serializeChecklistState(next), orderId],
      );

      await tx.query(
        `INSERT INTO historial_estatus_orden (orden_id, estatus_anterior, estatus_nuevo, cambiado_por, nota)
         VALUES ($1, $2, 'en_progreso', $3, 'PIN cliente validado')`,
        [orderId, order.estatus, userId],
      );

      return NextResponse.json({ data: { validado: true, iniciado_en: now } });
    });
  },
});
