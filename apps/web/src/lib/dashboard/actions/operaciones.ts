'use server';

import { revalidatePath } from 'next/cache';
import { withTransaction } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { getAssignmentBlocker } from '@/lib/provider/assignment';
import { publishOrderRealtimeEvent } from '@/lib/realtime/ably';

interface ActionResult {
  ok: boolean;
  message?: string;
}

const REASIGNABLES = new Set(['solicitada', 'asignada', 'en_camino']);

export async function asignarOrden(
  ordenId: string,
  prestadorId: string,
): Promise<ActionResult> {
  const viewer = await requirePermiso('ordenes.editar');

  return await withTransaction(async (tx) => {
    const orden = await tx.queryOne<{
      estatus: string;
      prestador_id: string | null;
      servicio_id: string;
    }>(
      `SELECT estatus::text AS estatus, prestador_id, servicio_id
       FROM ordenes_servicio WHERE id = $1 FOR UPDATE`,
      [ordenId],
    );
    if (!orden) return { ok: false, message: 'Orden no encontrada' };
    if (orden.estatus !== 'solicitada') {
      return {
        ok: false,
        message: `Solo se asignan órdenes en estatus 'solicitada' (actual: ${orden.estatus}). Para cambiar prestador asignado, usa reasignar.`,
      };
    }

    const blocker = await getAssignmentBlocker(tx, ordenId, prestadorId);
    if (blocker) return { ok: false, message: blocker };

    await tx.query(
      `UPDATE ordenes_servicio
       SET prestador_id = $1, estatus = 'asignada', updated_at = NOW()
       WHERE id = $2`,
      [prestadorId, ordenId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'orden.asignada',
      entidad: 'ordenes_servicio',
      entidadId: ordenId,
      valorAnterior: { estatus: orden.estatus, prestador_id: orden.prestador_id },
      valorNuevo: { estatus: 'asignada', prestador_id: prestadorId },
    });

    const eventOrder = await tx.queryOne<{
      cliente_id: string;
      servicio_nombre: string;
    }>(
      `SELECT o.cliente_id, s.nombre AS servicio_nombre
       FROM ordenes_servicio o
       JOIN servicios s ON s.id = o.servicio_id
       WHERE o.id = $1`,
      [ordenId],
    );

    if (eventOrder) {
      await publishOrderRealtimeEvent({
        clientId: eventOrder.cliente_id,
        providerId: prestadorId,
        name: 'order.assigned',
        data: {
          orderId: ordenId,
          status: 'asignada',
          serviceName: eventOrder.servicio_nombre,
          deeplink: `/jobs/${ordenId}`,
        },
      });
    }

    revalidatePath('/dashboard/operaciones');
    revalidatePath(`/dashboard/operaciones/orden/${ordenId}`);
    revalidatePath('/dashboard/ordenes');
    return { ok: true };
  });
}

export async function reasignarOrden(
  ordenId: string,
  prestadorId: string,
  motivo: string,
): Promise<ActionResult> {
  const viewer = await requirePermiso('ordenes.reasignar');
  const motivoTrim = motivo.trim();
  if (motivoTrim.length < 5) {
    return { ok: false, message: 'El motivo necesita al menos 5 caracteres' };
  }

  return await withTransaction(async (tx) => {
    const orden = await tx.queryOne<{
      estatus: string;
      prestador_id: string | null;
    }>(
      `SELECT estatus::text AS estatus, prestador_id
       FROM ordenes_servicio WHERE id = $1 FOR UPDATE`,
      [ordenId],
    );
    if (!orden) return { ok: false, message: 'Orden no encontrada' };
    if (!REASIGNABLES.has(orden.estatus)) {
      return {
        ok: false,
        message: `No se puede reasignar en estatus '${orden.estatus}'`,
      };
    }
    if (orden.prestador_id === prestadorId) {
      return {
        ok: false,
        message: 'Ese prestador ya está asignado a esta orden',
      };
    }

    const blocker = await getAssignmentBlocker(tx, ordenId, prestadorId);
    if (blocker) return { ok: false, message: blocker };

    await tx.query(
      `UPDATE ordenes_servicio
       SET prestador_id = $1,
           estatus = CASE WHEN estatus = 'solicitada' THEN 'asignada' ELSE 'asignada' END,
           notas_prestador = COALESCE(notas_prestador, '')
             || E'\n[REASIGNADA] ' || $2,
           updated_at = NOW()
       WHERE id = $3`,
      [prestadorId, motivoTrim, ordenId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'orden.reasignada',
      entidad: 'ordenes_servicio',
      entidadId: ordenId,
      valorAnterior: {
        estatus: orden.estatus,
        prestador_id: orden.prestador_id,
      },
      valorNuevo: {
        estatus: 'asignada',
        prestador_id: prestadorId,
        motivo: motivoTrim,
      },
    });

    const eventOrder = await tx.queryOne<{
      cliente_id: string;
      servicio_nombre: string;
    }>(
      `SELECT o.cliente_id, s.nombre AS servicio_nombre
       FROM ordenes_servicio o
       JOIN servicios s ON s.id = o.servicio_id
       WHERE o.id = $1`,
      [ordenId],
    );

    if (eventOrder) {
      await publishOrderRealtimeEvent({
        clientId: eventOrder.cliente_id,
        providerId: prestadorId,
        name: 'order.assigned',
        data: {
          orderId: ordenId,
          status: 'asignada',
          serviceName: eventOrder.servicio_nombre,
          deeplink: `/jobs/${ordenId}`,
        },
      });
    }

    revalidatePath('/dashboard/operaciones');
    revalidatePath(`/dashboard/operaciones/orden/${ordenId}`);
    revalidatePath('/dashboard/ordenes');
    return { ok: true };
  });
}
