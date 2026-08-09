import { NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { idParamSchema, mobileProviderJobStatusUpdateSchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import { NotFoundError, UnprocessableError } from '@/lib/errors/http-errors';
import { publishOrderRealtimeEvent } from '@/lib/realtime/ably';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  asignada: ['en_camino'],
  en_camino: ['en_progreso'],
  en_progreso: ['completada'],
};

export const PATCH = defineEndpoint({
  tag: 'PATCH /api/mobile/provider/jobs/[id]/status',
  auth: { role: ['prestador'] },
  paramsSchema: idParamSchema,
  bodySchema: mobileProviderJobStatusUpdateSchema,
  handler: async ({ params, body, session }) => {
    const orden = await queryOne<{
      id: string;
      estatus: string;
      cliente_id: string;
      prestador_id: string;
      servicio_nombre: string;
    }>(
      `SELECT o.id, o.estatus, o.cliente_id, o.prestador_id, s.nombre AS servicio_nombre
       FROM ordenes_servicio o
       JOIN servicios s ON s.id = o.servicio_id
       WHERE o.id = $1 AND o.prestador_id = $2`,
      [params.id, session!.sub]
    );
    if (!orden) throw new NotFoundError('Trabajo no encontrado');

    const allowed = ALLOWED_TRANSITIONS[orden.estatus] ?? [];
    if (!allowed.includes(body.estatus)) {
      throw new UnprocessableError(
        `No se puede cambiar de '${orden.estatus}' a '${body.estatus}'`
      );
    }

    const updated = await queryOne<{
      id: string;
      estatus: string;
      total: number;
      fecha_programada: string | null;
      notas: string | null;
    }>(
      `UPDATE ordenes_servicio SET estatus = $1::estatus_orden WHERE id = $2
       RETURNING id, estatus, monto_total AS total, fecha_programada, notas_cliente AS notas`,
      [body.estatus, params.id]
    );

    await queryOne(
      `INSERT INTO historial_estatus_orden (orden_id, estatus_anterior, estatus_nuevo, cambiado_por)
       VALUES ($1, $2::estatus_orden, $3::estatus_orden, $4)`,
      [params.id, orden.estatus, body.estatus, session!.sub]
    );

    await publishOrderRealtimeEvent({
      clientId: orden.cliente_id,
      providerId: orden.prestador_id,
      name: 'order.status_changed',
      data: {
        orderId: params.id,
        status: body.estatus,
        serviceName: orden.servicio_nombre,
        deeplink: `/jobs/${params.id}`,
      },
    });

    return NextResponse.json({ orden: updated });
  },
});
