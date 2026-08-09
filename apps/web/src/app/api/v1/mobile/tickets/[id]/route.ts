import { NextResponse } from 'next/server';
import { query, queryOne } from '@expressmx/database';
import { idParamSchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import { NotFoundError } from '@/lib/errors/http-errors';

interface TicketRow {
  id: string;
  asunto: string;
  categoria: string;
  estatus: string;
  tipo: string;
  tier_actual: string;
  created_at: string;
  updated_at: string;
}

interface MensajeRow {
  id: string;
  contenido: string;
  tipo_autor: string;
  created_at: string;
}

interface TareaVisibleRow {
  id: string;
  asunto: string;
  titulo_cliente: string | null;
  estado: string;
  completada_at: string | null;
  created_at: string;
}

export const GET = defineEndpoint({
  tag: 'GET /api/v1/mobile/tickets/[id]',
  auth: 'session',
  paramsSchema: idParamSchema,
  handler: async ({ params, session }) => {
    const ticket = await queryOne<TicketRow>(
      `SELECT id, asunto, categoria::text, estatus::text, tipo::text,
              tier_actual::text, created_at, updated_at
         FROM tickets_soporte
        WHERE id = $1 AND usuario_id = $2`,
      [params.id, session!.sub],
    );

    if (!ticket) throw new NotFoundError('Reporte no encontrado');

    const mensajes = await query<MensajeRow>(
      `SELECT id, contenido, tipo_autor::text, created_at
         FROM mensajes_ticket
        WHERE ticket_id = $1 AND es_interno = FALSE
        ORDER BY created_at ASC`,
      [params.id],
    );

    let tareas_visibles: TareaVisibleRow[] = [];
    try {
      tareas_visibles = await query<TareaVisibleRow>(
        `SELECT id, asunto, titulo_cliente, estado::text, completada_at, created_at
           FROM tareas_caso
          WHERE ticket_id = $1 AND visible_cliente = TRUE
          ORDER BY created_at ASC`,
        [params.id],
      );
    } catch {
      tareas_visibles = [];
    }

    return NextResponse.json({
      data: {
        ticket,
        mensajes,
        tareas_visibles,
      },
    });
  },
});
