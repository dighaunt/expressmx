import { NextResponse } from 'next/server';
import { query } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireSession } from '@/lib/auth/mobile';

interface OrdenElegibleRow {
  id: string;
  servicio_nombre: string;
  estatus: string;
  monto_total: string;
  fecha_programada: string | null;
  created_at: string;
  dentro_ventana: boolean;
  dias_desde_creacion: number;
  ya_tiene_ticket_abierto: boolean;
  ticket_abierto_id: string | null;
}

export const GET = withApiHandler(async (req) => {
  const session = await requireSession(req);

  const rows = await query<OrdenElegibleRow>(
    `SELECT o.id,
            s.nombre AS servicio_nombre,
            o.estatus::text AS estatus,
            o.monto_total::text AS monto_total,
            o.fecha_programada,
            o.created_at,
            (NOW() - o.created_at <= INTERVAL '30 days') AS dentro_ventana,
            GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 86400))::int
              AS dias_desde_creacion,
            EXISTS(
              SELECT 1 FROM tickets_soporte t
               WHERE t.orden_id = o.id
                 AND t.usuario_id = $1
                 AND t.estatus IN ('abierto','en_revision','escalado')
            ) AS ya_tiene_ticket_abierto,
            (SELECT t.id FROM tickets_soporte t
              WHERE t.orden_id = o.id
                AND t.usuario_id = $1
                AND t.estatus IN ('abierto','en_revision','escalado')
              ORDER BY t.created_at DESC LIMIT 1) AS ticket_abierto_id
       FROM ordenes_servicio o
       JOIN servicios s ON s.id = o.servicio_id
      WHERE o.cliente_id = $1
        AND o.created_at >= NOW() - INTERVAL '60 days'
      ORDER BY o.created_at DESC
      LIMIT 20`,
    [session.sub],
  );

  return NextResponse.json({
    data: rows.map((r) => ({
      id: r.id,
      servicio_nombre: r.servicio_nombre,
      estatus: r.estatus,
      monto_total: Number(r.monto_total),
      fecha_programada: r.fecha_programada,
      created_at: r.created_at,
      dentro_ventana: r.dentro_ventana,
      dias_desde_creacion: r.dias_desde_creacion,
      ya_tiene_ticket_abierto: r.ya_tiene_ticket_abierto,
      ticket_abierto_id: r.ticket_abierto_id,
    })),
  });
}, 'GET /api/v1/mobile/orders/elegibles-soporte');
