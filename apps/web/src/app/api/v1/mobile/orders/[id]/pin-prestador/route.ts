import { NextResponse } from 'next/server';
import { withTransaction } from '@expressmx/database';
import { mobileClientPinPrestadorSchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/errors/http-errors';
import {
  parseChecklistState,
  serializeChecklistState,
} from '@/lib/provider/job-state';

const MAX_INTENTOS = 5;

interface OrderRow {
  id: string;
  cliente_id: string;
  estatus: string;
  pin_prestador: string | null;
  notas_prestador: string | null;
}

export const POST = defineEndpoint({
  tag: 'POST /api/v1/mobile/orders/[id]/pin-prestador',
  auth: 'session',
  bodySchema: mobileClientPinPrestadorSchema,
  handler: async ({ params, body, session }) => {
    const orderId = (params as { id: string }).id;
    const userId = session!.sub;

    return await withTransaction(async (tx) => {
      const order = await tx.queryOne<OrderRow>(
        `SELECT id, cliente_id, estatus, pin_prestador, notas_prestador
         FROM ordenes_servicio WHERE id = $1 FOR UPDATE`,
        [orderId],
      );

      if (!order) throw new NotFoundError('No encontramos esa orden');
      if (order.cliente_id !== userId) {
        throw new ForbiddenError('Esta orden no es tuya');
      }
      if (order.estatus === 'completada') {
        throw new ConflictError('La orden ya está completada');
      }
      if (order.estatus !== 'en_progreso') {
        throw new ConflictError('El servicio aún no está listo para cerrar');
      }
      if (!order.pin_prestador) {
        throw new ConflictError('La orden no tiene PIN de cierre configurado');
      }

      const state = parseChecklistState(order.notas_prestador);
      if (state.pin_prestador_confirmed_at) {
        return NextResponse.json({ data: { ya_confirmado: true } });
      }

      if (state.pin_prestador_intentos >= MAX_INTENTOS) {
        throw new ConflictError(
          'Demasiados intentos. Pídele al prestador que te muestre el PIN de cierre otra vez.',
        );
      }

      if (body.pin !== order.pin_prestador) {
        const next = serializeChecklistState({
          ...state,
          pin_prestador_intentos: state.pin_prestador_intentos + 1,
        });
        await tx.query(
          `UPDATE ordenes_servicio SET notas_prestador = $1 WHERE id = $2`,
          [next, orderId],
        );
        throw new BadRequestError(
          'El PIN no coincide. Pide al prestador que te lo confirme.',
        );
      }

      const now = new Date().toISOString();
      const next = serializeChecklistState({
        ...state,
        pin_prestador_confirmed_at: now,
        pin_prestador_intentos: 0,
      });

      await tx.query(
        `UPDATE ordenes_servicio
         SET notas_prestador = $1, updated_at = NOW()
         WHERE id = $2`,
        [next, orderId],
      );

      await tx.query(
        `INSERT INTO historial_estatus_orden (orden_id, estatus_anterior, estatus_nuevo, cambiado_por, nota)
         VALUES ($1, $2, $2, $3, 'PIN de cierre confirmado por el cliente')`,
        [orderId, order.estatus, userId],
      );

      return NextResponse.json({ data: { confirmado: true, confirmado_en: now } });
    });
  },
});
