import { NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { idParamSchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import { NotFoundError } from '@/lib/errors/http-errors';
import { parseChecklistState } from '@/lib/provider/job-state';

export const GET = defineEndpoint({
  tag: 'GET /api/mobile/orders/[id]',
  auth: 'session',
  paramsSchema: idParamSchema,
  handler: async ({ params, session }) => {
    const orden = await queryOne<{
      id: string;
      estatus: string;
      fecha_creacion: string;
      fecha_programada: string;
      total: string;
      descuento: string;
      cupon_codigo: string | null;
      pagado: string;
      servicio_nombre: string;
      prestador_nombre: string | null;
      prestador_telefono: string | null;
      direccion: string | null;
      direccion_latitud: string | null;
      direccion_longitud: string | null;
      pin_cliente: string | null;
      notas_prestador: string | null;
      pagos_procesados: string;
      pagos_reembolsados: string;
      reembolsos_count: number;
      tickets_reembolso_30d: number;
    }>(
      `SELECT
        o.id,
        o.estatus,
        o.created_at AS fecha_creacion,
        o.fecha_programada,
        o.monto_total::text AS total,
        COALESCE(o.descuento, 0)::text AS descuento,
        cup.codigo AS cupon_codigo,
        COALESCE((
          SELECT SUM(p.monto)
            FROM pagos p
           WHERE p.orden_id = o.id AND p.estatus = 'procesado'::estatus_pago
        ), 0)::text AS pagado,
        o.pin_cliente,
        o.notas_prestador,
        COALESCE((
          SELECT SUM(p.monto)
            FROM pagos p
           WHERE p.orden_id = o.id AND p.estatus = 'procesado'::estatus_pago
        ), 0)::text AS pagos_procesados,
        COALESCE((
          SELECT SUM(p.monto)
            FROM pagos p
           WHERE p.orden_id = o.id AND p.estatus = 'reembolsado'::estatus_pago
        ), 0)::text AS pagos_reembolsados,
        (SELECT COUNT(*)::int
           FROM reembolsos r
           JOIN pagos pr ON pr.id = r.pago_id
          WHERE pr.orden_id = o.id
            AND r.estatus IN ('solicitado','aprobado','procesado')) AS reembolsos_count,
        (SELECT COUNT(*)::int
           FROM tickets_soporte t
          WHERE t.usuario_id = o.cliente_id
            AND t.categoria = 'cobro_incorrecto'::cat_ticket
            AND t.created_at >= NOW() - INTERVAL '30 days') AS tickets_reembolso_30d,
        s.nombre AS servicio_nombre,
        CONCAT(p2.nombre, ' ', p2.apellidos) AS prestador_nombre,
        p2.telefono AS prestador_telefono,
        CONCAT(d.calle, ' ', d.numero_ext, ', ', d.colonia, ', ', d.ciudad) AS direccion,
        d.latitud::text AS direccion_latitud,
        d.longitud::text AS direccion_longitud
       FROM ordenes_servicio o
       JOIN servicios s ON s.id = o.servicio_id
       LEFT JOIN cupones cup ON cup.id = o.cupon_id
       LEFT JOIN usuarios p2 ON p2.id = o.prestador_id
       LEFT JOIN direcciones d ON d.id = o.direccion_id
       WHERE o.id = $1 AND o.cliente_id = $2`,
      [params.id, session!.sub]
    );

    if (!orden) throw new NotFoundError('Orden no encontrada');

    const checklist = parseChecklistState(orden.notas_prestador);
    const totalNum = Number(orden.total);
    const pagadoNum = Number(orden.pagado);
    const pagoPendiente = totalNum > 0 && pagadoNum + 0.005 < totalNum;
    const pagosProcesados = Number(orden.pagos_procesados);
    const pagosReembolsados = Number(orden.pagos_reembolsados);
    const puedeSolicitarReembolso =
      pagosProcesados > 0 &&
      pagosReembolsados <= 0 &&
      orden.reembolsos_count === 0 &&
      ['completada', 'cancelada'].includes(orden.estatus) &&
      orden.tickets_reembolso_30d < 3;

    return NextResponse.json({
      orden: {
        id: orden.id,
        estatus: orden.estatus,
        fecha_creacion: orden.fecha_creacion,
        fecha_programada: orden.fecha_programada,
        total: totalNum,
        descuento: Number(orden.descuento),
        cupon_codigo: orden.cupon_codigo,
        servicio_nombre: orden.servicio_nombre,
        prestador_nombre: orden.prestador_nombre,
        prestador_telefono: orden.prestador_telefono,
        direccion: orden.direccion,
        direccion_latitud:
          orden.direccion_latitud === null ? null : Number(orden.direccion_latitud),
        direccion_longitud:
          orden.direccion_longitud === null ? null : Number(orden.direccion_longitud),
        pin_cliente: orden.pin_cliente,
        pin_prestador_confirmado: Boolean(checklist.pin_prestador_confirmed_at),
        pago_pendiente: pagoPendiente,
        refund_eligibility: {
          eligible: puedeSolicitarReembolso,
          requires_manual_review:
            pagosProcesados > 0 &&
            orden.reembolsos_count === 0 &&
            orden.tickets_reembolso_30d >= 3,
          reason:
            pagosProcesados <= 0
              ? 'sin_cargo_procesado'
              : pagosReembolsados > 0 || orden.reembolsos_count > 0
                ? 'reembolso_existente'
                : !['completada', 'cancelada'].includes(orden.estatus)
                  ? 'orden_activa'
                  : orden.tickets_reembolso_30d >= 3
                    ? 'revision_manual'
                    : 'candidato',
          processed_amount: pagosProcesados,
          refunded_amount: pagosReembolsados,
        },
      },
    });
  },
});
