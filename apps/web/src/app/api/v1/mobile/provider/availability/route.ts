import { NextResponse } from 'next/server';
import { query } from '@expressmx/database';
import { defineEndpoint } from '@/lib/api/handler';
import { ForbiddenError } from '@/lib/errors/http-errors';

interface SlotRow {
  id: string;
  dia: 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom';
  hora_inicio: string;
  hora_fin: string;
}

export const GET = defineEndpoint({
  tag: 'GET /api/v1/mobile/provider/availability',
  auth: { role: ['prestador'] },
  handler: async ({ session }) => {
    const rows = await query<SlotRow>(
      `SELECT id, dia, hora_inicio, hora_fin
       FROM disponibilidad_prestador
       WHERE prestador_id = $1
       ORDER BY dia ASC, hora_inicio ASC`,
      [session!.sub],
    );
    return NextResponse.json({ data: rows });
  },
});

export const PUT = defineEndpoint({
  tag: 'PUT /api/v1/mobile/provider/availability',
  auth: { role: ['prestador'] },
  handler: async () => {
    throw new ForbiddenError('Operaciones administra los horarios de los empleados');
  },
});
