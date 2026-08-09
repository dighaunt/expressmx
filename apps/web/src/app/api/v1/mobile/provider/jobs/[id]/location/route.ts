import { NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { idParamSchema, mobileProviderLocationSchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import { NotFoundError, UnprocessableError } from '@/lib/errors/http-errors';
import { publishOrderRealtimeEvent } from '@/lib/realtime/ably';

export const POST = defineEndpoint({
  tag: 'POST /api/v1/mobile/provider/jobs/[id]/location',
  auth: { role: ['prestador'] },
  paramsSchema: idParamSchema,
  bodySchema: mobileProviderLocationSchema,
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
      [params.id, session!.sub],
    );

    if (!orden) throw new NotFoundError('Trabajo no encontrado');

    if (!['en_camino', 'en_progreso'].includes(orden.estatus)) {
      throw new UnprocessableError('La ubicación solo se comparte durante una orden activa');
    }

    await publishOrderRealtimeEvent({
      clientId: orden.cliente_id,
      providerId: orden.prestador_id,
      name: 'order.provider_location',
      data: {
        orderId: params.id,
        status: orden.estatus,
        serviceName: orden.servicio_nombre,
        providerLatitude: body.latitude,
        providerLongitude: body.longitude,
        providerAccuracy: body.accuracy ?? null,
        providerHeading: body.heading ?? null,
        providerSpeed: body.speed ?? null,
        providerLocationUpdatedAt: body.timestamp ?? new Date().toISOString(),
      },
    });

    return NextResponse.json({ ok: true });
  },
});
