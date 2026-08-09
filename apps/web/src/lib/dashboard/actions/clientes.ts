'use server';

import { revalidatePath } from 'next/cache';
import { withTransaction } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

interface ActionResult {
  ok: boolean;
  message?: string;
}

export async function restringirCliente(
  clienteId: string,
  motivo: string,
): Promise<ActionResult> {
  const viewer = await requirePermiso('usuarios.editar');
  const motivoTrim = motivo.trim();
  if (motivoTrim.length < 5) {
    return { ok: false, message: 'El motivo necesita al menos 5 caracteres' };
  }

  return await withTransaction(async (tx) => {
    const target = await tx.queryOne<{ rol: string }>(
      `SELECT rol FROM usuarios WHERE id = $1 FOR UPDATE`,
      [clienteId],
    );
    if (!target) return { ok: false, message: 'No encontramos al cliente' };
    if (target.rol !== 'cliente') {
      return { ok: false, message: 'Esa cuenta no es un cliente' };
    }

    await tx.query(
      `UPDATE usuarios
       SET motivo_restriccion = $2,
           restringido_en = NOW(),
           restringido_por = $3
       WHERE id = $1`,
      [clienteId, motivoTrim, viewer.userId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'cliente.restringido',
      entidad: 'usuarios',
      entidadId: clienteId,
      valorNuevo: { motivo: motivoTrim },
    });

    revalidatePath(`/dashboard/clientes/${clienteId}`);
    revalidatePath(`/dashboard/clientes`);
    return { ok: true };
  });
}

export async function quitarRestriccionCliente(clienteId: string): Promise<ActionResult> {
  const viewer = await requirePermiso('usuarios.editar');

  return await withTransaction(async (tx) => {
    const target = await tx.queryOne<{
      rol: string;
      restringido_en: string | null;
      motivo_restriccion: string | null;
    }>(
      `SELECT rol, restringido_en, motivo_restriccion FROM usuarios WHERE id = $1 FOR UPDATE`,
      [clienteId],
    );
    if (!target) return { ok: false, message: 'No encontramos al cliente' };
    if (!target.restringido_en) return { ok: true };

    await tx.query(
      `UPDATE usuarios
       SET motivo_restriccion = NULL,
           restringido_en = NULL,
           restringido_por = NULL
       WHERE id = $1`,
      [clienteId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'cliente.restriccion_quitada',
      entidad: 'usuarios',
      entidadId: clienteId,
      valorAnterior: { motivo: target.motivo_restriccion, restringido_en: target.restringido_en },
    });

    revalidatePath(`/dashboard/clientes/${clienteId}`);
    revalidatePath(`/dashboard/clientes`);
    return { ok: true };
  });
}
