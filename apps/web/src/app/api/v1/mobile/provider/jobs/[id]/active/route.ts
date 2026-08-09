import { NextResponse } from 'next/server';
import { query, queryOne } from '@expressmx/database';
import { defineEndpoint } from '@/lib/api/handler';
import { ForbiddenError, NotFoundError } from '@/lib/errors/http-errors';
import {
  type ChecklistState,
  parseChecklistState,
  computeCronometro,
} from '@/lib/provider/job-state';

interface OrderRow {
  id: string;
  estatus: string;
  servicio: string;
  cliente: string;
  prestador_id: string | null;
  notas_prestador: string | null;
  updated_at: string;
  direccion: string | null;
  direccion_latitud: string | null;
  direccion_longitud: string | null;
}

interface EvidenciaCountRow {
  fase: string;
  total: number;
}

interface CargoExtraRow {
  id: string;
  descripcion: string;
  monto: string;
  estatus: 'propuesto' | 'aceptado' | 'rechazado';
}

export const GET = defineEndpoint({
  tag: 'GET /api/v1/mobile/provider/jobs/[id]/active',
  auth: { role: ['prestador'] },
  handler: async ({ params, session }) => {
    const orderId = (params as { id: string }).id;
    const userId = session!.sub;

    const order = await queryOne<OrderRow>(
      `SELECT
       o.id, o.estatus, o.notas_prestador, o.prestador_id, o.updated_at,
       s.nombre AS servicio,
         (u.nombre || ' ' || COALESCE(LEFT(u.apellidos, 1) || '.', '')) AS cliente,
         CONCAT(d.calle, ' ', d.numero_ext, ', ', d.colonia, ', ', d.ciudad) AS direccion,
         d.latitud::text AS direccion_latitud,
         d.longitud::text AS direccion_longitud
       FROM ordenes_servicio o
       JOIN servicios s ON s.id = o.servicio_id
       JOIN usuarios u ON u.id = o.cliente_id
       LEFT JOIN direcciones d ON d.id = o.direccion_id
       WHERE o.id = $1`,
      [orderId],
    );

    if (!order) throw new NotFoundError('No encontramos esa orden');
    if (order.prestador_id !== userId) {
      throw new ForbiddenError('Esa orden no está asignada a ti');
    }

    const checklist: ChecklistState = parseChecklistState(order.notas_prestador);

    const evidencias = await query<EvidenciaCountRow>(
      `SELECT fase, COUNT(*)::INT AS total
       FROM evidencias_orden
       WHERE orden_id = $1 AND subida_por = $2
       GROUP BY fase`,
      [orderId, userId],
    );
    const evidenciasMap = new Map(evidencias.map((e) => [e.fase, e.total]));

    const cargos = await query<CargoExtraRow>(
      `SELECT id, descripcion, monto, estatus
       FROM cargos_extra_orden
       WHERE orden_id = $1
       ORDER BY created_at ASC`,
      [orderId],
    );

    const pasos: string[] = [];
    if (checklist.pin_cliente_validated_at) pasos.push('pin_cliente');
    if (checklist.foto_antes_done_at) pasos.push('foto_antes');
    if (checklist.diagnostico_done_at) pasos.push('diagnostico');
    if (checklist.reparacion_done_at) pasos.push('reparacion');
    if (checklist.foto_despues_done_at) pasos.push('foto_despues');
    if (checklist.pin_prestador_confirmed_at) pasos.push('pin_prestador');

    const cronometro = computeCronometro(checklist);

    return NextResponse.json({
      data: {
        orden_id: order.id,
        servicio_nombre: order.servicio,
        cliente_nombre: order.cliente,
        direccion: order.direccion,
        direccion_latitud:
          order.direccion_latitud === null ? null : Number(order.direccion_latitud),
        direccion_longitud:
          order.direccion_longitud === null ? null : Number(order.direccion_longitud),
        cronometro_segundos: cronometro.segundos,
        cronometro_corriendo: cronometro.corriendo,
        pasos_completados: pasos,
        evidencias_count: {
          antes: evidenciasMap.get('antes') ?? 0,
          despues: evidenciasMap.get('despues') ?? 0,
        },
        cargos_extra: cargos.map((c) => ({
          id: c.id,
          descripcion: c.descripcion,
          monto: Number(c.monto),
          estatus: c.estatus,
        })),
      },
    });
  },
});
