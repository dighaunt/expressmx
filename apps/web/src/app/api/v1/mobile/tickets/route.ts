import { NextResponse } from 'next/server';
import { query, queryOne, withTransaction } from '@expressmx/database';
import { mobileTicketCreateSchema } from '@expressmx/validations';
import { withApiHandler } from '@/lib/api/handler';
import { requireSession } from '@/lib/auth/mobile';
import {
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
} from '@/lib/errors/http-errors';
import { publishTicketRealtimeEvent } from '@/lib/realtime/ably';

interface TicketRow {
  id: string;
  asunto: string;
  estatus: string;
  categoria: string;
  created_at: string;
}

const REEMBOLSO_MOTIVO_LABEL: Record<string, string> = {
  cobro_duplicado: 'Cobro duplicado',
  monto_incorrecto: 'Monto incorrecto',
  servicio_no_recibido: 'Servicio no recibido',
  cargo_no_reconocido: 'Cargo no reconocido',
};

export const GET = withApiHandler(async (req) => {
  const session = await requireSession(req);

  const rows = await query<TicketRow>(
    `SELECT id, asunto, estatus, categoria, created_at
     FROM tickets_soporte
     WHERE usuario_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [session.sub]
  );

  return NextResponse.json({ data: rows });
}, 'GET /api/v1/mobile/tickets');

export const POST = withApiHandler(async (req) => {
  const session = await requireSession(req);
  const body = mobileTicketCreateSchema.parse(await req.json());

  const providerPayrollReport = session.rol === 'prestador' && body.categoria === 'cobro_incorrecto';

  if (!body.orden_id && body.categoria !== 'otro' && !providerPayrollReport) {
    throw new UnprocessableError(
      'Selecciona un pedido para reportar este problema.',
    );
  }

  if (body.orden_id) {
    const orden = await queryOne<{
      cliente_id: string;
      prestador_id: string | null;
      estatus: string;
      dentro_ventana: boolean;
      pagos_procesados: string;
      pagos_reembolsados: string;
      reembolsos_count: number;
      tickets_reembolso_30d: number;
    }>(
            `SELECT cliente_id,
              prestador_id,
              estatus::text AS estatus,
              (NOW() - created_at <= INTERVAL '30 days') AS dentro_ventana,
              COALESCE((
                SELECT SUM(p.monto)
                  FROM pagos p
                 WHERE p.orden_id = ordenes_servicio.id
                   AND p.estatus = 'procesado'::estatus_pago
              ), 0)::text AS pagos_procesados,
              COALESCE((
                SELECT SUM(p.monto)
                  FROM pagos p
                 WHERE p.orden_id = ordenes_servicio.id
                   AND p.estatus = 'reembolsado'::estatus_pago
              ), 0)::text AS pagos_reembolsados,
              (SELECT COUNT(*)::int
                 FROM reembolsos r
                 JOIN pagos pr ON pr.id = r.pago_id
                WHERE pr.orden_id = ordenes_servicio.id
                  AND r.estatus IN ('solicitado','aprobado','procesado')) AS reembolsos_count,
              (SELECT COUNT(*)::int
                 FROM tickets_soporte t
                WHERE t.usuario_id = ordenes_servicio.cliente_id
                  AND t.categoria = 'cobro_incorrecto'::cat_ticket
                  AND t.created_at >= NOW() - INTERVAL '30 days') AS tickets_reembolso_30d
         FROM ordenes_servicio
        WHERE id = $1`,
      [body.orden_id],
    );

    if (!orden) throw new NotFoundError('Pedido no encontrado');
    const ownsOrder =
      (session.rol === 'cliente' && orden.cliente_id === session.sub) ||
      (session.rol === 'prestador' && orden.prestador_id === session.sub);
    if (!ownsOrder) {
      throw new ForbiddenError('Esa orden no es tuya');
    }
    if (!orden.dentro_ventana) {
      throw new UnprocessableError(
        'Solo puedes reportar problemas de pedidos de los últimos 30 días. Llama a soporte si necesitas ayuda con un pedido más antiguo.',
      );
    }

    if (session.rol === 'cliente' && body.categoria === 'cobro_incorrecto') {
      if (body.diagnostico?.tipo !== 'reembolso') {
        throw new UnprocessableError(
          'Usa la guía de reembolsos para validar si tu pedido es candidato.',
        );
      }

      const pagosProcesados = Number(orden.pagos_procesados);
      const pagosReembolsados = Number(orden.pagos_reembolsados);

      if (pagosProcesados <= 0) {
        throw new UnprocessableError(
          'No encontramos un cargo procesado para este pedido.',
        );
      }
      if (pagosReembolsados > 0 || orden.reembolsos_count > 0) {
        throw new UnprocessableError(
          'Este pedido ya tiene un reembolso o solicitud activa.',
        );
      }
      if (!['completada', 'cancelada'].includes(orden.estatus)) {
        throw new UnprocessableError(
          'Solo podemos revisar reembolsos cuando el pedido ya terminó o fue cancelado.',
        );
      }
      if (
        orden.tickets_reembolso_30d >= 3 &&
        body.diagnostico.elegibilidad !== 'revision_manual'
      ) {
        throw new UnprocessableError(
          'Tu solicitud requiere revisión manual. Continúa desde ayuda especializada.',
        );
      }
    }

    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM tickets_soporte
        WHERE orden_id = $1
          AND usuario_id = $2
          AND estatus IN ('abierto','en_revision','escalado')
        LIMIT 1`,
      [body.orden_id, session.sub],
    );

    if (existing) {
      throw new UnprocessableError(
        `Ya tienes un caso abierto para este pedido (#${existing.id.slice(0, 8).toUpperCase()}). Continúa la conversación ahí.`,
      );
    }
  }

  const grupoAsignado =
    session.rol === 'prestador' && body.orden_id && body.categoria !== 'cobro_incorrecto'
      ? 'operaciones_l1'
      : null;

  const created = await withTransaction(async (tx) => {
    const descripcion =
      body.categoria === 'cobro_incorrecto' && body.diagnostico?.tipo === 'reembolso'
        ? [
            `Solicitud de reembolso: ${REEMBOLSO_MOTIVO_LABEL[body.diagnostico.motivo]}`,
            `Resultado de elegibilidad: ${body.diagnostico.elegibilidad}`,
            '',
            body.descripcion,
          ].join('\n')
        : body.descripcion;

    const ticket = await tx.queryOne<{ id: string; created_at: string }>(
      `INSERT INTO tickets_soporte
         (usuario_id, orden_id, categoria, asunto, grupo_asignado, prioridad, estatus, tipo, tier_actual)
       VALUES ($1, $2, $3::cat_ticket, $4, $5,
               'media'::prioridad_ticket, 'abierto'::estatus_ticket,
               'incidente'::tipo_ticket, 'l1'::tier_soporte)
       RETURNING id, created_at`,
      [session.sub, body.orden_id ?? null, body.categoria, body.asunto, grupoAsignado]
    );

    if (!ticket) throw new Error('No se pudo crear el ticket');

    const mensaje = await tx.queryOne<{ id: string; created_at: string }>(
      `INSERT INTO mensajes_ticket (ticket_id, autor_id, tipo_autor, contenido, es_interno)
       VALUES ($1, $2, 'usuario'::tipo_autor_msg, $3, false)
       RETURNING id, created_at`,
      [ticket.id, session.sub, descripcion]
    );
    if (!mensaje) throw new Error('No se pudo crear el mensaje inicial');

    return { ...ticket, mensaje_id: mensaje.id, mensaje_created_at: mensaje.created_at, descripcion };
  });

  await publishTicketRealtimeEvent({
    ticketId: created.id,
    name: 'ticket.message_created',
    data: {
      ticketId: created.id,
      messageId: created.mensaje_id,
      content: created.descripcion,
      authorId: session.sub,
      authorName: null,
      authorType: 'usuario',
      internal: false,
      createdAt: created.mensaje_created_at,
    },
  });

  return NextResponse.json(
    {
      data: {
        id: created.id,
        asunto: body.asunto,
        categoria: body.categoria,
        estatus: 'abierto',
        created_at: created.created_at,
      },
    },
    { status: 201 }
  );
}, 'POST /api/v1/mobile/tickets');
