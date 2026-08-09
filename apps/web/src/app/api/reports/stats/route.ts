import { NextResponse } from 'next/server';
import { query } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { requireAdminSession } from '@/lib/auth/session';

export const GET = withApiHandler(async () => {
  await requireAdminSession();

  const [stats, ordenesRecientes, topServicios] = await Promise.all([
    query(`
      SELECT
        (SELECT COUNT(*) FROM usuarios WHERE rol = 'cliente' AND activo = true)::int AS total_clientes,
        (SELECT COUNT(*) FROM usuarios WHERE rol = 'prestador' AND activo = true)::int AS total_prestadores,
        (SELECT COUNT(*) FROM ordenes_servicio)::int AS total_ordenes,
        (SELECT COUNT(*) FROM ordenes_servicio WHERE estatus = 'completada')::int AS ordenes_completadas,
        (SELECT COUNT(*) FROM ordenes_servicio WHERE estatus = 'en_progreso')::int AS ordenes_en_proceso,
        (SELECT COUNT(*) FROM ordenes_servicio WHERE estatus = 'solicitada')::int AS ordenes_pendientes,
        (SELECT COALESCE(SUM(monto_total), 0) FROM ordenes_servicio WHERE estatus = 'completada')::numeric AS ingresos_totales,
        (SELECT COUNT(*) FROM servicios WHERE activo = true)::int AS total_servicios
    `),
    query(`
      SELECT
        o.id, o.estatus, o.monto_total, o.created_at,
        s.nombre AS servicio_nombre,
        c.nombre || ' ' || c.apellidos AS cliente_nombre
      FROM ordenes_servicio o
      JOIN servicios s ON s.id = o.servicio_id
      JOIN usuarios c ON c.id = o.cliente_id
      ORDER BY o.created_at DESC
      LIMIT 5
    `),
    query(`
      SELECT
        s.nombre, COUNT(o.id)::int AS total
      FROM servicios s
      JOIN ordenes_servicio o ON o.servicio_id = s.id
      GROUP BY s.id, s.nombre
      ORDER BY total DESC
      LIMIT 5
    `),
  ]);

  return NextResponse.json({
    stats: stats[0],
    ordenesRecientes,
    topServicios,
  });
}, 'GET /api/reports/stats');
