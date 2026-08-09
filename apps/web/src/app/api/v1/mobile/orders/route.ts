import { NextResponse } from 'next/server';
import { query, queryOne, withTransaction, type Tx } from '@expressmx/database';
import {
  mobileCreateOrderSchema,
  mobileOrdersListQuerySchema,
} from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import { buildPage, decodeCursor } from '@/lib/api/cursor';
import { NotFoundError, UnprocessableError } from '@/lib/errors/http-errors';
import {
  PROVIDER_NOTIFICATION_SOUND,
  PROVIDER_ORDER_CHANNEL_ID,
  sendPushNotificationToUser,
} from '@/lib/notifications/push';
import { publishOrderRealtimeEvent } from '@/lib/realtime/ably';

interface OrderRow {
  id: string;
  estatus: string;
  created_at: string;
  fecha_creacion: string;
  servicio_nombre: string;
  prestador_nombre: string | null;
  total: number;
}

interface AssignedOrderRow {
  id: string;
  cliente_id: string;
  prestador_id: string | null;
  servicio_nombre: string;
  fecha_programada: string;
  direccion: string | null;
  direccion_latitud: string | null;
  direccion_longitud: string | null;
  zona: string | null;
}

interface ServicePriceRow {
  precio_base: string;
  categoria_id: string;
}

interface AddressCoverageRow {
  id: string;
  latitud: string | null;
  longitud: string | null;
  zona_id: string | null;
  zona_nombre: string | null;
  tipo_ajuste: 'multiplicador' | 'monto_fijo' | null;
  valor: string | null;
}

interface CuponRow {
  id: string;
  codigo: string;
  tipo_descuento: 'porcentaje' | 'monto_fijo';
  valor: string;
  usos_maximos: number | null;
  usos_actuales: number | null;
  solo_primera_compra: boolean;
  categoria_id: string | null;
}

export const GET = defineEndpoint({
  tag: 'GET /api/v1/mobile/orders',
  auth: 'session',
  querySchema: mobileOrdersListQuerySchema,
  handler: async ({ query: q, session }) => {
    const limit = q.limit ?? 20;
    const cursor = q.cursor ? decodeCursor(q.cursor) : null;

    const rows = await query<OrderRow>(
      `SELECT
        o.id,
        o.estatus,
        o.created_at,
        o.created_at AS fecha_creacion,
        s.nombre AS servicio_nombre,
        CONCAT(p.nombre, ' ', p.apellidos) AS prestador_nombre,
        o.monto_total AS total
       FROM ordenes_servicio o
       JOIN servicios s ON s.id = o.servicio_id
       LEFT JOIN usuarios p ON p.id = o.prestador_id
       WHERE o.cliente_id = $1
         AND ($2::timestamptz IS NULL OR (o.created_at, o.id) < ($2::timestamptz, $3::uuid))
       ORDER BY o.created_at DESC, o.id DESC
       LIMIT $4`,
      [session!.sub, cursor?.at ?? null, cursor?.id ?? null, limit + 1]
    );

    const page = buildPage(rows, limit, (row) => ({ at: row.created_at, id: row.id }));
    return NextResponse.json(page);
  },
});

export const POST = defineEndpoint({
  tag: 'POST /api/v1/mobile/orders',
  auth: 'session',
  bodySchema: mobileCreateOrderSchema,
  handler: async ({ body, session }) => {
    const servicio = await queryOne<ServicePriceRow>(
      'SELECT precio_base::text AS precio_base, categoria_id FROM servicios WHERE id = $1 AND activo = true',
      [body.servicio_id]
    );
    if (!servicio) throw new NotFoundError('Servicio no encontrado');

    const fechaProg = new Date(body.fecha_programada).toISOString();

    assertFutureCdmxTime(fechaProg);

    const direccion = await queryOne<AddressCoverageRow>(
      `SELECT
         d.id,
         d.latitud::text AS latitud,
         d.longitud::text AS longitud,
         z.zona_id,
         z.zona_nombre,
         z.tipo_ajuste,
         z.valor::text AS valor
       FROM direcciones d
       LEFT JOIN LATERAL public.zona_operativa_para_punto(
         d.latitud,
         d.longitud,
         $2::uuid,
         $3::date
       ) z ON TRUE
       WHERE d.usuario_id = $1
         AND ($4::uuid IS NULL OR d.id = $4::uuid)
       ORDER BY d.predeterminada DESC, d.id ASC
       LIMIT 1`,
      [session!.sub, body.servicio_id, fechaProg.slice(0, 10), body.direccion_id ?? null]
    );
    if (!direccion) {
      throw new UnprocessableError(
        body.direccion_id
          ? 'No encontramos esa dirección en tu cuenta'
          : 'Agrega una dirección antes de solicitar un servicio',
      );
    }
    if (direccion.latitud === null || direccion.longitud === null) {
      throw new UnprocessableError(
        'Tu dirección necesita coordenadas verificables para confirmar cobertura',
      );
    }
    if (direccion.zona_id === null) {
      throw new UnprocessableError('Tu dirección está fuera de una zona de cobertura activa');
    }

    const montoTotal = computeZonePrice({
      precioBase: Number(servicio.precio_base),
      tipoAjuste: direccion.tipo_ajuste,
      valor: direccion.valor === null ? null : Number(direccion.valor),
    });

    const providersAvailable = await countAvailableProviders({
      servicioId: body.servicio_id,
      direccion,
      fechaProgramada: fechaProg,
    });
    if (providersAvailable <= 0) {
      throw new UnprocessableError('Ese horario ya no está disponible. Elige otro slot.');
    }

    const result = await createOrder({
      clienteId: session!.sub,
      servicioId: body.servicio_id,
      direccionId: direccion.id,
      montoTotal,
      fechaProgramada: fechaProg,
      notas: body.notas ?? null,
      cuponCodigo: body.cupon_codigo ?? null,
      categoriaId: servicio.categoria_id,
    });

    const assignedOrder = await queryOne<AssignedOrderRow>(
      `SELECT
         o.id,
         o.cliente_id,
         o.prestador_id,
         o.fecha_programada,
         s.nombre AS servicio_nombre,
         CONCAT(d.calle, ' ', d.numero_ext, ', ', d.colonia, ', ', d.ciudad) AS direccion,
         d.latitud::text AS direccion_latitud,
         d.longitud::text AS direccion_longitud,
         COALESCE(z.zona_nombre, d.colonia) AS zona
       FROM ordenes_servicio o
       JOIN servicios s ON s.id = o.servicio_id
       LEFT JOIN direcciones d ON d.id = o.direccion_id
       LEFT JOIN LATERAL public.zona_operativa_para_punto(
         d.latitud,
         d.longitud,
         o.servicio_id,
         o.fecha_programada::date
       ) z ON TRUE
       WHERE o.id = $1`,
      [result.id],
    );

    if (assignedOrder?.prestador_id) {
      const deeplink = `/jobs/${assignedOrder.id}`;
      const hora = new Date(assignedOrder.fecha_programada).toLocaleString('es-MX', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      const title = 'Nueva solicitud de servicio';
      const notificationBody = `${assignedOrder.servicio_nombre} · ${hora}`;

      await query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, cuerpo, canal, deeplink)
         VALUES ($1, 'push', $2, $3, 'orden', $4)`,
        [assignedOrder.prestador_id, title, notificationBody, deeplink],
      );

      await sendPushNotificationToUser({
        userId: assignedOrder.prestador_id,
        app: 'provider',
        title,
        body: notificationBody,
        deeplink,
        channelId: PROVIDER_ORDER_CHANNEL_ID,
        sound: PROVIDER_NOTIFICATION_SOUND,
      });

      await publishOrderRealtimeEvent({
        clientId: assignedOrder.cliente_id,
        providerId: assignedOrder.prestador_id,
        name: 'order.assigned',
        data: {
          orderId: assignedOrder.id,
          status: 'asignada',
          serviceName: assignedOrder.servicio_nombre,
          title,
          body: notificationBody,
          deeplink,
          scheduledAt: assignedOrder.fecha_programada,
          address: assignedOrder.direccion,
          zone: assignedOrder.zona,
          latitude:
            assignedOrder.direccion_latitud === null ? null : Number(assignedOrder.direccion_latitud),
          longitude:
            assignedOrder.direccion_longitud === null ? null : Number(assignedOrder.direccion_longitud),
        },
      });
    }

    return NextResponse.json({ data: { id: result.id } }, { status: 201 });
  },
});

async function createOrder(input: {
  clienteId: string;
  servicioId: string;
  direccionId: string;
  montoTotal: number;
  fechaProgramada: string;
  notas: string | null;
  cuponCodigo: string | null;
  categoriaId: string;
}): Promise<{ id: string }> {
  try {
    const result = await withTransaction(async (tx) => {
      const discount = input.cuponCodigo
        ? await applyCoupon(tx, {
            codigo: input.cuponCodigo,
            clienteId: input.clienteId,
            categoriaId: input.categoriaId,
            subtotal: input.montoTotal,
          })
        : { cuponId: null, descuento: 0 };

      const total = Math.max(0, Math.round((input.montoTotal - discount.descuento) * 100) / 100);
      const inserted = await tx.queryOne<{ id: string }>(
        `INSERT INTO ordenes_servicio
           (cliente_id, servicio_id, direccion_id, cupon_id, monto_total, descuento, fecha_programada, notas_cliente)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          input.clienteId,
          input.servicioId,
          input.direccionId,
          discount.cuponId,
          total,
          discount.descuento,
          input.fechaProgramada,
          input.notas,
        ],
      );
      return inserted;
    });

    if (!result) throw new Error('No se pudo crear la orden');
    return result;
  } catch (err) {
    if (isCoverageConstraintError(err)) {
      throw new UnprocessableError(
        getDbMessage(err) ?? 'Tu dirección está fuera de una zona de cobertura activa',
      );
    }
    throw err;
  }
}

async function applyCoupon(
  tx: Tx,
  input: { codigo: string; clienteId: string; categoriaId: string; subtotal: number },
): Promise<{ cuponId: string | null; descuento: number }> {
  const cupon = await tx.queryOne<CuponRow>(
    `SELECT id,
            codigo,
            tipo_descuento::text AS tipo_descuento,
            valor::text AS valor,
            usos_maximos,
            usos_actuales,
            solo_primera_compra,
            categoria_id
       FROM cupones
      WHERE UPPER(codigo) = UPPER($1)
        AND fecha_inicio <= CURRENT_DATE
        AND fecha_expiracion >= CURRENT_DATE
      FOR UPDATE`,
    [input.codigo],
  );
  if (!cupon) throw new UnprocessableError('Cupón no vigente');
  if (cupon.usos_maximos !== null && (cupon.usos_actuales ?? 0) >= cupon.usos_maximos) {
    throw new UnprocessableError('Cupón agotado');
  }
  if (cupon.categoria_id && cupon.categoria_id !== input.categoriaId) {
    throw new UnprocessableError('El cupón no aplica a este servicio');
  }
  if (cupon.solo_primera_compra) {
    const previous = await tx.queryOne<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
           FROM ordenes_servicio o
           JOIN pagos p ON p.orden_id = o.id
          WHERE o.cliente_id = $1
            AND p.estatus = 'procesado'
       ) AS exists`,
      [input.clienteId],
    );
    if (previous?.exists) throw new UnprocessableError('Cupón solo para primera compra');
  }

  const valor = Number(cupon.valor);
  const descuento =
    cupon.tipo_descuento === 'porcentaje'
      ? Math.min(Math.round(input.subtotal * (valor / 100) * 100) / 100, input.subtotal)
      : Math.min(valor, input.subtotal);

  await tx.query(`UPDATE cupones SET usos_actuales = usos_actuales + 1 WHERE id = $1`, [cupon.id]);
  return { cuponId: cupon.id, descuento };
}

async function countAvailableProviders(input: {
  servicioId: string;
  direccion: AddressCoverageRow;
  fechaProgramada: string;
}): Promise<number> {
  const row = await queryOne<{ total: number }>(
    `WITH slot AS (
       SELECT
         $2::timestamptz AS inicio,
         $2::timestamptz + (COALESCE(s.duracion_estimada_min, 60) || ' minutes')::interval AS fin,
         ($2::timestamptz AT TIME ZONE 'America/Mexico_City') AS inicio_local,
         (($2::timestamptz + (COALESCE(s.duracion_estimada_min, 60) || ' minutes')::interval) AT TIME ZONE 'America/Mexico_City') AS fin_local,
         s.id AS servicio_id
       FROM servicios s
       WHERE s.id = $1
     )
     SELECT COUNT(DISTINCT u.id)::INT AS total
       FROM slot
       JOIN servicios_prestador sp ON sp.servicio_id = slot.servicio_id AND sp.activo = TRUE
      JOIN usuarios u ON u.id = sp.prestador_id
      WHERE u.rol = 'prestador'
        AND u.activo = TRUE
        AND u.recibe_ordenes = TRUE
        AND u.restringido_en IS NULL
        AND (
          NOT EXISTS (
            SELECT 1
              FROM disponibilidad_prestador any_dp
             WHERE any_dp.prestador_id = u.id
          )
          OR EXISTS (
              SELECT 1
                FROM disponibilidad_prestador dp
               WHERE dp.prestador_id = u.id
                 AND dp.dia = CASE EXTRACT(ISODOW FROM slot.inicio_local)::int
                   WHEN 1 THEN 'lun'::dia_semana
                   WHEN 2 THEN 'mar'::dia_semana
                   WHEN 3 THEN 'mie'::dia_semana
                   WHEN 4 THEN 'jue'::dia_semana
                   WHEN 5 THEN 'vie'::dia_semana
                   WHEN 6 THEN 'sab'::dia_semana
                   ELSE 'dom'::dia_semana
                 END
                 AND slot.inicio_local::date = slot.fin_local::date
                 AND dp.hora_inicio <= slot.inicio_local::time
                 AND dp.hora_fin >= slot.fin_local::time
                 AND (
                   $3::numeric IS NULL
                   OR $4::numeric IS NULL
                   OR dp.zona_lat IS NULL
                   OR dp.zona_lng IS NULL
                   OR (
                     SQRT(
                       POW((dp.zona_lat - $3::numeric) * 111, 2) +
                       POW((dp.zona_lng - $4::numeric) * 111 * COS(RADIANS($3::numeric)), 2)
                     ) <= COALESCE(dp.radio_cobertura_km, 10)
                   )
                 )
            )
        )
        AND NOT EXISTS (
          SELECT 1
            FROM ordenes_servicio ox
            JOIN servicios sx ON sx.id = ox.servicio_id
           WHERE ox.prestador_id = u.id
             AND ox.estatus NOT IN ('completada', 'cancelada')
             AND tstzrange(
               ox.fecha_programada,
               ox.fecha_programada + (COALESCE(sx.duracion_estimada_min, 60) || ' minutes')::interval
             ) && tstzrange(slot.inicio, slot.fin)
        )`,
    [input.servicioId, input.fechaProgramada, input.direccion.latitud, input.direccion.longitud],
  );
  return row?.total ?? 0;
}

function assertFutureCdmxTime(iso: string): void {
  const scheduled = new Date(iso);
  if (Number.isNaN(scheduled.getTime())) throw new UnprocessableError('Fecha inválida');
  const minTime = Date.now() + 30 * 60 * 1000;
  if (scheduled.getTime() < minTime) {
    throw new UnprocessableError('Elige un horario futuro en horario central de la Ciudad de México');
  }
  const parts = cdmxParts(scheduled);
  const minutes = parts.hour * 60 + parts.minute;
  if (parts.minute % 30 !== 0 || minutes < 8 * 60 || minutes >= 20 * 60) {
    throw new UnprocessableError(
      'Elige un slot disponible entre 08:00 y 20:00 en horario central de la Ciudad de México',
    );
  }
}

function cdmxParts(date: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  return {
    hour: Number(parts.find((p) => p.type === 'hour')?.value ?? 0),
    minute: Number(parts.find((p) => p.type === 'minute')?.value ?? 0),
  };
}

function computeZonePrice(input: {
  precioBase: number;
  tipoAjuste: 'multiplicador' | 'monto_fijo' | null;
  valor: number | null;
}): number {
  const total =
    input.tipoAjuste === 'multiplicador' && input.valor !== null
      ? input.precioBase * input.valor
      : input.tipoAjuste === 'monto_fijo' && input.valor !== null
        ? input.precioBase + input.valor
        : input.precioBase;

  return Math.round(total * 100) / 100;
}

function isCoverageConstraintError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? String(err.code) : '';
  const message = getDbMessage(err) ?? '';
  return code === '23514' && /dirección|Servicio|cobertura|operativa/i.test(message);
}

function getDbMessage(err: unknown): string | null {
  if (!err || typeof err !== 'object' || !('message' in err)) return null;
  return typeof err.message === 'string' ? err.message : null;
}
