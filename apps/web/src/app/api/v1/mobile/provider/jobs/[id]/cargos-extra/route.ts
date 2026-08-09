import { NextResponse } from 'next/server';
import { withTransaction } from '@expressmx/database';
import { mobileProviderCargoExtraSchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
} from '@/lib/errors/http-errors';

interface OrderRow {
  id: string;
  prestador_id: string | null;
  estatus: string;
}

const MAX_CARGOS_PROPUESTOS = 5;

export const POST = defineEndpoint({
  tag: 'POST /api/v1/mobile/provider/jobs/[id]/cargos-extra',
  auth: { role: ['prestador'] },
  bodySchema: mobileProviderCargoExtraSchema,
  handler: async ({ params, body, session }) => {
    const orderId = (params as { id: string }).id;
    const userId = session!.sub;

    return await withTransaction(async (tx) => {
      const order = await tx.queryOne<OrderRow>(
        `SELECT id, prestador_id, estatus
         FROM ordenes_servicio WHERE id = $1 FOR UPDATE`,
        [orderId],
      );

      if (!order) throw new NotFoundError('No encontramos esa orden');
      if (order.prestador_id !== userId) {
        throw new ForbiddenError('Esa orden no está asignada a ti');
      }
      if (order.estatus === 'completada' || order.estatus === 'cancelada') {
        throw new ConflictError('La orden ya está cerrada, no se aceptan más sobrecostos');
      }

      const pending = await tx.queryOne<{ total: number }>(
        `SELECT COUNT(*)::INT AS total
         FROM cargos_extra_orden
         WHERE orden_id = $1 AND estatus = 'propuesto'`,
        [orderId],
      );
      if (pending && pending.total >= MAX_CARGOS_PROPUESTOS) {
        throw new UnprocessableError(
          'Hay demasiados sobrecostos pendientes. Espera a que el cliente apruebe los anteriores.',
        );
      }

      const created = await tx.queryOne<{
        id: string;
        descripcion: string;
        monto: string;
        estatus: 'propuesto';
      }>(
        `INSERT INTO cargos_extra_orden (orden_id, descripcion, monto, propuesto_por)
         VALUES ($1, $2, $3, $4)
         RETURNING id, descripcion, monto, estatus`,
        [orderId, body.descripcion, body.monto, userId],
      );

      return NextResponse.json(
        {
          data: created
            ? {
                id: created.id,
                descripcion: created.descripcion,
                monto: Number(created.monto),
                estatus: created.estatus,
              }
            : null,
        },
        { status: 201 },
      );
    });
  },
});
