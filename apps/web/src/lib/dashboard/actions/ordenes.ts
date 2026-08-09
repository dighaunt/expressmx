'use server';

import { revalidatePath } from 'next/cache';
import { withTransaction } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

interface ActionResult {
  ok: boolean;
  message?: string;
}

const CANCELABLES = new Set(['solicitada', 'asignada']);

export async function cancelarOrden(
  ordenId: string,
  motivo: string,
  options: { casoId?: string; ticketId?: string } = {},
): Promise<ActionResult> {
  const viewer = await requirePermiso('ordenes.cancelar');
  const motivoTrim = motivo.trim();
  if (motivoTrim.length < 5) {
    return { ok: false, message: 'El motivo necesita al menos 5 caracteres' };
  }

  return await withTransaction(async (tx) => {
    const orden = await tx.queryOne<{
      cliente_id: string;
      estatus: string;
      monto_total: string;
    }>(
      `SELECT cliente_id, estatus::text AS estatus, monto_total::text AS monto_total
       FROM ordenes_servicio WHERE id = $1 FOR UPDATE`,
      [ordenId],
    );
    if (!orden) return { ok: false, message: 'Orden no encontrada' };
    if (!CANCELABLES.has(orden.estatus)) {
      return {
        ok: false,
        message: `No se puede cancelar: estatus actual ${orden.estatus}`,
      };
    }

    if (options.casoId) {
      const caso = await tx.queryOne<{ ok: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM casos_soporte_abiertos
           WHERE id = $1
             AND agente_id = $2
             AND cliente_id = $3
             AND cerrado_en IS NULL
             AND expira_en > NOW()
         ) AS ok`,
        [options.casoId, viewer.userId, orden.cliente_id],
      );
      if (!caso?.ok) {
        return {
          ok: false,
          message: 'El caso ya no está activo o no corresponde a este cliente',
        };
      }
    }

    await tx.query(
      `UPDATE ordenes_servicio
       SET estatus = 'cancelada',
           notas_prestador = COALESCE(notas_prestador, '')
             || E'\n[CANCELADA por admin] ' || $2,
           updated_at = NOW()
       WHERE id = $1`,
      [ordenId, motivoTrim],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'orden.cancelada',
      entidad: 'ordenes_servicio',
      entidadId: ordenId,
      valorAnterior: { estatus: orden.estatus, monto_total: orden.monto_total },
      valorNuevo: {
        estatus: 'cancelada',
        motivo: motivoTrim,
        cliente_id: orden.cliente_id,
      },
      casoId: options.casoId ?? null,
      ticketId: options.ticketId ?? null,
    });

    revalidatePath('/dashboard/ordenes');
    revalidatePath('/dashboard/soporte');
    return { ok: true };
  });
}
