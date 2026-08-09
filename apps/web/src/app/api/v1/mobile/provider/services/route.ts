import { NextResponse } from 'next/server';
import { query } from '@expressmx/database';
import { defineEndpoint } from '@/lib/api/handler';
import { ForbiddenError } from '@/lib/errors/http-errors';

interface ServiceRow {
  id: string;
  servicio_id: string;
  nombre: string;
  categoria: string;
  precio_base: string;
  activo: boolean;
}

export const GET = defineEndpoint({
  tag: 'GET /api/v1/mobile/provider/services',
  auth: { role: ['prestador'] },
  handler: async ({ session }) => {
    const rows = await query<ServiceRow>(
      `SELECT sp.id, sp.servicio_id, sp.activo, s.nombre, s.precio_base,
              c.nombre AS categoria
       FROM servicios_prestador sp
       JOIN servicios s ON s.id = sp.servicio_id
       JOIN categorias_servicio c ON c.id = s.categoria_id
       WHERE sp.prestador_id = $1
         AND s.activo = TRUE
         AND c.activa = TRUE
       ORDER BY c.nombre, s.nombre`,
      [session!.sub],
    );

    return NextResponse.json({
      data: rows.map((r) => ({
        id: r.id,
        servicio_id: r.servicio_id,
        nombre: r.nombre,
        categoria: r.categoria,
        precio_base: Number(r.precio_base),
        activo: r.activo,
      })),
    });
  },
});

export const PUT = defineEndpoint({
  tag: 'PUT /api/v1/mobile/provider/services',
  auth: { role: ['prestador'] },
  handler: async () => {
    throw new ForbiddenError('Operaciones administra las capacidades de los empleados');
  },
});
