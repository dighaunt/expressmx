'use server';

import { revalidatePath } from 'next/cache';
import { query, queryOne, withTransaction } from '@expressmx/database';
import { logAccion, logAccionDirecta } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface ComisionInput {
  categoria_id: string;
  porcentaje_base: number;
  porcentaje_volumen: number | null;
  umbral_ordenes_mes: number | null;
  vigencia_inicio: string;
  vigencia_fin: string | null;
  activa: boolean;
}

function validar(input: ComisionInput): string | null {
  if (!input.categoria_id) return 'Selecciona una categoría';
  if (!Number.isFinite(input.porcentaje_base) || input.porcentaje_base < 0 || input.porcentaje_base > 100) {
    return 'El porcentaje base debe estar entre 0 y 100';
  }
  if (
    input.porcentaje_volumen !== null &&
    (!Number.isFinite(input.porcentaje_volumen) ||
      input.porcentaje_volumen < 0 ||
      input.porcentaje_volumen > 100)
  ) {
    return 'El porcentaje por volumen debe estar entre 0 y 100';
  }
  if (
    input.umbral_ordenes_mes !== null &&
    (!Number.isInteger(input.umbral_ordenes_mes) || input.umbral_ordenes_mes < 0)
  ) {
    return 'El umbral de órdenes debe ser un entero positivo';
  }
  if (input.porcentaje_volumen !== null && input.umbral_ordenes_mes === null) {
    return 'Si defines porcentaje por volumen, también especifica el umbral de órdenes';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.vigencia_inicio)) {
    return 'Fecha de inicio inválida';
  }
  if (input.vigencia_fin !== null && !/^\d{4}-\d{2}-\d{2}$/.test(input.vigencia_fin)) {
    return 'Fecha de fin inválida';
  }
  if (
    input.vigencia_fin !== null &&
    new Date(input.vigencia_fin).getTime() < new Date(input.vigencia_inicio).getTime()
  ) {
    return 'La vigencia final no puede ser anterior al inicio';
  }
  return null;
}

export async function crearComision(
  input: ComisionInput,
): Promise<ActionResult & { id?: string }> {
  const viewer = await requirePermiso('comisiones.gestionar');
  const error = validar(input);
  if (error) return { ok: false, message: error };

  return await withTransaction(async (tx) => {
    const cat = await tx.queryOne<{ id: string }>(
      `SELECT id FROM categorias_servicio WHERE id = $1 AND activa = TRUE`,
      [input.categoria_id],
    );
    if (!cat) return { ok: false, message: 'La categoría no existe o está inactiva' };

    const created = await tx.queryOne<{ id: string }>(
      `INSERT INTO comisiones_plataforma
         (categoria_id, porcentaje_base, porcentaje_volumen,
          umbral_ordenes_mes, vigencia_inicio, vigencia_fin, activa)
       VALUES ($1, $2, $3, $4, $5::date, $6::date, $7)
       RETURNING id`,
      [
        input.categoria_id,
        input.porcentaje_base,
        input.porcentaje_volumen,
        input.umbral_ordenes_mes,
        input.vigencia_inicio,
        input.vigencia_fin,
        input.activa,
      ],
    );
    if (!created) return { ok: false, message: 'No pudimos crear la comisión' };

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'comision.creada',
      entidad: 'comisiones_plataforma',
      entidadId: created.id,
      valorNuevo: input,
    });

    revalidatePath('/dashboard/sistema');
    return { ok: true, id: created.id };
  });
}

export async function actualizarComision(
  id: string,
  input: ComisionInput,
): Promise<ActionResult> {
  const viewer = await requirePermiso('comisiones.gestionar');
  const error = validar(input);
  if (error) return { ok: false, message: error };

  const previo = await queryOne<Record<string, unknown>>(
    `SELECT categoria_id, porcentaje_base::text AS porcentaje_base,
            porcentaje_volumen::text AS porcentaje_volumen, umbral_ordenes_mes,
            to_char(vigencia_inicio, 'YYYY-MM-DD') AS vigencia_inicio,
            to_char(vigencia_fin, 'YYYY-MM-DD') AS vigencia_fin, activa
     FROM comisiones_plataforma WHERE id = $1`,
    [id],
  );

  const updated = await queryOne<{ id: string }>(
    `UPDATE comisiones_plataforma
     SET categoria_id = $1,
         porcentaje_base = $2,
         porcentaje_volumen = $3,
         umbral_ordenes_mes = $4,
         vigencia_inicio = $5::date,
         vigencia_fin = $6::date,
         activa = $7
     WHERE id = $8
     RETURNING id`,
    [
      input.categoria_id,
      input.porcentaje_base,
      input.porcentaje_volumen,
      input.umbral_ordenes_mes,
      input.vigencia_inicio,
      input.vigencia_fin,
      input.activa,
      id,
    ],
  );
  if (!updated) return { ok: false, message: 'No encontramos la comisión' };

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'comision.actualizada',
    entidad: 'comisiones_plataforma',
    entidadId: id,
    valorAnterior: previo ?? undefined,
    valorNuevo: input,
  });

  revalidatePath('/dashboard/sistema');
  return { ok: true };
}

export async function eliminarComision(id: string): Promise<ActionResult> {
  const viewer = await requirePermiso('comisiones.gestionar');

  const previo = await queryOne<{ categoria_id: string }>(
    `SELECT categoria_id FROM comisiones_plataforma WHERE id = $1`,
    [id],
  );

  await query(`DELETE FROM comisiones_plataforma WHERE id = $1`, [id]);

  if (previo) {
    await logAccionDirecta({
      adminId: viewer.userId,
      accion: 'comision.eliminada',
      entidad: 'comisiones_plataforma',
      entidadId: id,
      valorAnterior: previo,
    });
  }

  revalidatePath('/dashboard/sistema');
  return { ok: true };
}
