import { NextResponse } from 'next/server';
import { withTransaction } from '@expressmx/database';
import { idParamSchema, mobileTicketResponderSchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import { NotFoundError } from '@/lib/errors/http-errors';
import { publishTicketRealtimeEvent } from '@/lib/realtime/ably';

interface MensajeRealtimeRow {
  id: string;
  ticket_id: string;
  autor_id: string | null;
  autor_nombre: string | null;
  tipo_autor: 'usuario' | 'agente' | 'sistema';
  contenido: string;
  es_interno: boolean;
  created_at: string;
}

export const POST = defineEndpoint({
  tag: 'POST /api/v1/mobile/tickets/[id]/responder',
  auth: 'session',
  paramsSchema: idParamSchema,
  bodySchema: mobileTicketResponderSchema,
  handler: async ({ params, body, session }) => {
    const result = await withTransaction(async (tx) => {
      const ticket = await tx.queryOne<{ id: string }>(
        `SELECT id FROM tickets_soporte
          WHERE id = $1 AND usuario_id = $2`,
        [params.id, session!.sub],
      );

      if (!ticket) throw new NotFoundError('Reporte no encontrado');

      const mensaje = await tx.queryOne<MensajeRealtimeRow>(
        `INSERT INTO mensajes_ticket
           (ticket_id, autor_id, tipo_autor, contenido, es_interno)
         VALUES ($1, $2, 'usuario'::tipo_autor_msg, $3, FALSE)
         RETURNING
           id,
           ticket_id,
           autor_id,
           (SELECT nombre || ' ' || apellidos FROM usuarios WHERE id = $2) AS autor_nombre,
           tipo_autor::text AS tipo_autor,
           contenido,
           es_interno,
           created_at`,
        [params.id, session!.sub, body.contenido],
      );

      if (!mensaje) throw new Error('No se pudo guardar la respuesta');

      await tx.query(
        `UPDATE tickets_soporte SET updated_at = NOW() WHERE id = $1`,
        [params.id],
      );

      return mensaje;
    });

    await publishTicketRealtimeEvent({
      ticketId: params.id,
      name: 'ticket.message_created',
      data: {
        ticketId: params.id,
        messageId: result.id,
        content: result.contenido,
        authorId: result.autor_id,
        authorName: result.autor_nombre,
        authorType: result.tipo_autor,
        internal: result.es_interno,
        createdAt: result.created_at,
      },
    });

    return NextResponse.json({ data: { mensajeId: result.id } }, { status: 201 });
  },
});
