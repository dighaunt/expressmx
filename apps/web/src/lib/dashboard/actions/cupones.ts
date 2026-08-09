'use server';

import { revalidatePath } from 'next/cache';
import { query, queryOne } from '@expressmx/database';
import { logAccionDirecta } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

interface ActionResult {
  ok: boolean;
  message?: string;
  id?: string;
}

export interface CuponInput {
  codigo: string;
  tipo_descuento: 'porcentaje' | 'monto_fijo';
  valor: number;
  fecha_inicio: string;
  fecha_expiracion: string;
  usos_maximos: number;
  solo_primera_compra: boolean;
  categoria_id: string | null;
}

function validar(input: CuponInput): string | null {
  const codigo = input.codigo.trim().toUpperCase();
  if (codigo.length < 3 || codigo.length > 32) return 'El código debe tener entre 3 y 32 caracteres';
  if (!/^[A-Z0-9_-]+$/.test(codigo)) return 'El código solo admite A-Z, 0-9, guion y guion bajo';
  if (!Number.isFinite(input.valor) || input.valor <= 0) return 'El valor debe ser positivo';
  if (input.tipo_descuento === 'porcentaje' && input.valor > 100) {
    return 'El porcentaje no puede ser mayor a 100';
  }
  if (input.tipo_descuento === 'monto_fijo' && input.valor > 99999) {
    return 'El monto excede el máximo permitido';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha_inicio)) return 'Fecha de inicio inválida';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha_expiracion)) return 'Fecha de expiración inválida';
  if (new Date(input.fecha_expiracion).getTime() < new Date(input.fecha_inicio).getTime()) {
    return 'La expiración debe ser posterior o igual al inicio';
  }
  if (!Number.isInteger(input.usos_maximos) || input.usos_maximos < 1 || input.usos_maximos > 100000) {
    return 'Los usos máximos deben estar entre 1 y 100,000';
  }
  return null;
}

export async function crearCupon(input: CuponInput): Promise<ActionResult> {
  const viewer = await requirePermiso('cupones.gestionar');
  const error = validar(input);
  if (error) return { ok: false, message: error };

  const codigo = input.codigo.trim().toUpperCase();
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM cupones WHERE codigo = $1`,
    [codigo],
  );
  if (existing) return { ok: false, message: 'Ya existe un cupón con ese código' };

  const created = await queryOne<{ id: string }>(
    `INSERT INTO cupones
       (codigo, tipo_descuento, valor, fecha_inicio, fecha_expiracion,
        usos_maximos, usos_actuales, solo_primera_compra, categoria_id)
     VALUES ($1, $2::tipo_descuento, $3, $4, $5, $6, 0, $7, $8)
     RETURNING id`,
    [
      codigo,
      input.tipo_descuento,
      input.valor,
      input.fecha_inicio,
      input.fecha_expiracion,
      input.usos_maximos,
      input.solo_primera_compra,
      input.categoria_id,
    ],
  );
  if (!created) return { ok: false, message: 'No pudimos crear el cupón' };

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'cupon.creado',
    entidad: 'cupones',
    entidadId: created.id,
    valorNuevo: { ...input, codigo },
  });

  revalidatePath('/dashboard/cupones');
  return { ok: true, id: created.id };
}

export async function actualizarCupon(id: string, input: CuponInput): Promise<ActionResult> {
  const viewer = await requirePermiso('cupones.gestionar');
  const error = validar(input);
  if (error) return { ok: false, message: error };

  const codigo = input.codigo.trim().toUpperCase();

  const conflict = await queryOne<{ id: string }>(
    `SELECT id FROM cupones WHERE codigo = $1 AND id <> $2`,
    [codigo, id],
  );
  if (conflict) return { ok: false, message: 'Ese código ya está en uso por otro cupón' };

  const current = await queryOne<{ usos_actuales: number }>(
    `SELECT usos_actuales FROM cupones WHERE id = $1`,
    [id],
  );
  if (!current) return { ok: false, message: 'No encontramos el cupón' };

  if (input.usos_maximos < current.usos_actuales) {
    return {
      ok: false,
      message: `El cupón ya se usó ${current.usos_actuales} veces, no puedes bajar el máximo por debajo`,
    };
  }

  await query(
    `UPDATE cupones SET
       codigo = $1,
       tipo_descuento = $2::tipo_descuento,
       valor = $3,
       fecha_inicio = $4,
       fecha_expiracion = $5,
       usos_maximos = $6,
       solo_primera_compra = $7,
       categoria_id = $8
     WHERE id = $9`,
    [
      codigo,
      input.tipo_descuento,
      input.valor,
      input.fecha_inicio,
      input.fecha_expiracion,
      input.usos_maximos,
      input.solo_primera_compra,
      input.categoria_id,
      id,
    ],
  );

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'cupon.actualizado',
    entidad: 'cupones',
    entidadId: id,
    valorNuevo: { ...input, codigo },
  });

  revalidatePath('/dashboard/cupones');
  revalidatePath(`/dashboard/cupones/${id}`);
  return { ok: true };
}

export async function detenerCupon(id: string): Promise<ActionResult> {
  const viewer = await requirePermiso('cupones.gestionar');
  const updated = await query<{ id: string }>(
    `UPDATE cupones SET usos_maximos = usos_actuales WHERE id = $1 RETURNING id`,
    [id],
  );
  if (updated.length === 0) return { ok: false, message: 'No encontramos el cupón' };

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'cupon.detenido',
    entidad: 'cupones',
    entidadId: id,
  });

  revalidatePath('/dashboard/cupones');
  revalidatePath(`/dashboard/cupones/${id}`);
  return { ok: true };
}
