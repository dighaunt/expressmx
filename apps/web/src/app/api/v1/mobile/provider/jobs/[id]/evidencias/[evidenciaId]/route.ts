import { NextResponse } from 'next/server';
import { query, queryOne } from '@expressmx/database';
import { defineEndpoint } from '@/lib/api/handler';
import { ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors/http-errors';

interface EvidenciaRow {
  id: string;
  orden_id: string;
  subida_por: string | null;
  prestador_id: string | null;
  estatus: string;
}

export const DELETE = defineEndpoint({
  tag: 'DELETE /api/v1/mobile/provider/jobs/[id]/evidencias/[evidenciaId]',
  auth: { role: ['prestador'] },
  handler: async ({ params, session }) => {
    const { id: orderId, evidenciaId } = params as { id: string; evidenciaId: string };
    const userId = session!.sub;

    const evid = await queryOne<EvidenciaRow>(
      `SELECT e.id, e.orden_id, e.subida_por, o.prestador_id, o.estatus
       FROM evidencias_orden e
       JOIN ordenes_servicio o ON o.id = e.orden_id
       WHERE e.id = $1 AND e.orden_id = $2`,
      [evidenciaId, orderId],
    );

    if (!evid) throw new NotFoundError('No encontramos esa foto');
    if (evid.prestador_id !== userId) {
      throw new ForbiddenError('Esa orden no está asignada a ti');
    }
    if (evid.subida_por !== userId) {
      throw new ForbiddenError('Solo puedes borrar las fotos que tú subiste');
    }
    if (evid.estatus === 'completada' || evid.estatus === 'cancelada') {
      throw new ConflictError('La orden ya está cerrada, no puedes modificar evidencias');
    }

    await query(`DELETE FROM evidencias_orden WHERE id = $1`, [evidenciaId]);

    return NextResponse.json({ data: { borrada: true } });
  },
});
