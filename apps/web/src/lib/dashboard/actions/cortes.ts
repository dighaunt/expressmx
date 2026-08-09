'use server';

import { revalidatePath } from 'next/cache';
import { withTransaction } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

interface ActionResult {
  ok: boolean;
  message?: string;
}

export async function marcarCorteRevisado(corteId: string): Promise<ActionResult> {
  const viewer = await requirePermiso('cortes.generar');

  return await withTransaction(async (tx) => {
    const target = await tx.queryOne<{ estatus: string }>(
      `SELECT estatus::text AS estatus FROM cortes_pago WHERE id = $1 FOR UPDATE`,
      [corteId],
    );
    if (!target) return { ok: false, message: 'Corte no encontrado' };
    if (target.estatus === 'depositado') {
      return { ok: false, message: 'Este corte ya fue depositado' };
    }
    if (target.estatus === 'revisado') return { ok: true };

    await tx.query(
      `UPDATE cortes_pago
       SET estatus = 'revisado', aprobado_por = $1
       WHERE id = $2`,
      [viewer.userId, corteId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'corte.revisado',
      entidad: 'cortes_pago',
      entidadId: corteId,
      valorAnterior: { estatus: target.estatus },
      valorNuevo: { estatus: 'revisado' },
    });

    revalidatePath('/dashboard/cortes');
    revalidatePath(`/dashboard/cortes/${corteId}`);
    return { ok: true };
  });
}

export async function marcarCorteDepositado(
  corteId: string,
  referenciaBancaria: string,
  fechaDeposito: string,
): Promise<ActionResult> {
  const viewer = await requirePermiso('cortes.generar');
  const ref = referenciaBancaria.trim();
  const fecha = fechaDeposito.trim();

  if (ref.length < 4) {
    return { ok: false, message: 'Ingresa una referencia bancaria válida' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { ok: false, message: 'Fecha de depósito inválida' };
  }

  return await withTransaction(async (tx) => {
    const target = await tx.queryOne<{ estatus: string; prestador_id: string }>(
      `SELECT estatus::text AS estatus, prestador_id
       FROM cortes_pago WHERE id = $1 FOR UPDATE`,
      [corteId],
    );
    if (!target) return { ok: false, message: 'Corte no encontrado' };
    if (target.estatus === 'depositado') {
      return { ok: false, message: 'Este corte ya fue depositado' };
    }

    await tx.query(
      `UPDATE cortes_pago
       SET estatus = 'depositado',
           referencia_bancaria = $1,
           fecha_deposito = $2::date,
           aprobado_por = COALESCE(aprobado_por, $3)
       WHERE id = $4`,
      [ref, fecha, viewer.userId, corteId],
    );

    await tx.query(
      `UPDATE transacciones_prestador
       SET estatus_deposito = 'depositado',
           referencia_bancaria = COALESCE(referencia_bancaria, $1)
       WHERE prestador_id = $2
         AND estatus_deposito = 'pendiente'
         AND DATE(created_at) <= (SELECT fecha_corte FROM cortes_pago WHERE id = $3)`,
      [ref, target.prestador_id, corteId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'corte.depositado',
      entidad: 'cortes_pago',
      entidadId: corteId,
      valorAnterior: { estatus: target.estatus },
      valorNuevo: {
        estatus: 'depositado',
        referencia_bancaria: ref,
        fecha_deposito: fecha,
        prestador_id: target.prestador_id,
      },
    });

    revalidatePath('/dashboard/cortes');
    revalidatePath(`/dashboard/cortes/${corteId}`);
    return { ok: true };
  });
}
