'use server';

import { revalidatePath } from 'next/cache';
import { query, queryOne } from '@expressmx/database';
import { logAccionDirecta } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface ServicioInput {
  nombre: string;
  descripcion: string | null;
  precio_base: number;
  precio_maximo: number | null;
  duracion_estimada_min: number | null;
  categoria_id: string;
  activo: boolean;
}

function validarServicio(input: ServicioInput): string | null {
  if (!input.nombre.trim()) return 'El nombre es obligatorio';
  if (input.nombre.length > 120) return 'El nombre es muy largo';
  if (!Number.isFinite(input.precio_base) || input.precio_base < 0) {
    return 'El precio base debe ser un número positivo';
  }
  if (input.precio_base > 99999) return 'El precio base excede el máximo permitido';
  if (
    input.precio_maximo !== null &&
    (!Number.isFinite(input.precio_maximo) || input.precio_maximo < input.precio_base)
  ) {
    return 'El precio máximo debe ser mayor o igual al base';
  }
  if (
    input.duracion_estimada_min !== null &&
    (!Number.isInteger(input.duracion_estimada_min) || input.duracion_estimada_min < 0)
  ) {
    return 'La duración debe ser un entero positivo';
  }
  return null;
}

export async function crearServicio(input: ServicioInput): Promise<ActionResult & { id?: string }> {
  const viewer = await requirePermiso('catalogo.crear');
  const error = validarServicio(input);
  if (error) return { ok: false, message: error };

  const categoria = await queryOne<{ id: string }>(
    `SELECT id FROM categorias_servicio WHERE id = $1 AND activa = TRUE`,
    [input.categoria_id],
  );
  if (!categoria) return { ok: false, message: 'La categoría no existe o está inactiva' };

  const created = await queryOne<{ id: string }>(
    `INSERT INTO servicios (
       categoria_id,
       nombre,
       descripcion,
       precio_base,
       precio_maximo,
       duracion_estimada_min,
       activo
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      input.categoria_id,
      input.nombre.trim(),
      input.descripcion?.trim() || null,
      input.precio_base,
      input.precio_maximo,
      input.duracion_estimada_min,
      input.activo,
    ],
  );
  if (!created) return { ok: false, message: 'No pudimos crear el servicio' };

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'servicio.creado',
    entidad: 'servicios',
    entidadId: created.id,
    valorNuevo: input,
  });

  revalidatePath('/dashboard/servicios');
  return { ok: true, id: created.id };
}

export async function actualizarServicio(
  id: string,
  input: ServicioInput,
): Promise<ActionResult> {
  const viewer = await requirePermiso('catalogo.editar');
  const error = validarServicio(input);
  if (error) return { ok: false, message: error };

  const categoria = await queryOne<{ id: string }>(
    `SELECT id FROM categorias_servicio WHERE id = $1 AND activa = TRUE`,
    [input.categoria_id],
  );
  if (!categoria) return { ok: false, message: 'La categoría no existe o está inactiva' };

  const updated = await queryOne<{ id: string }>(
    `UPDATE servicios
     SET nombre = $1,
         descripcion = $2,
         precio_base = $3,
         precio_maximo = $4,
         duracion_estimada_min = $5,
         categoria_id = $6,
         activo = $7
     WHERE id = $8
     RETURNING id`,
    [
      input.nombre.trim(),
      input.descripcion?.trim() || null,
      input.precio_base,
      input.precio_maximo,
      input.duracion_estimada_min,
      input.categoria_id,
      input.activo,
      id,
    ],
  );
  if (!updated) return { ok: false, message: 'No encontramos el servicio' };

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'servicio.actualizado',
    entidad: 'servicios',
    entidadId: id,
    valorNuevo: input,
  });

  revalidatePath('/dashboard/servicios');
  revalidatePath(`/dashboard/servicios/${id}`);
  return { ok: true };
}

export interface CategoriaInput {
  nombre: string;
  descripcion: string | null;
  orden_despliegue: number;
  activa: boolean;
}

function validarCategoria(input: CategoriaInput): string | null {
  if (!input.nombre.trim()) return 'El nombre es obligatorio';
  if (input.nombre.length > 80) return 'El nombre es muy largo';
  if (!Number.isInteger(input.orden_despliegue) || input.orden_despliegue < 0) {
    return 'El orden de despliegue debe ser un entero positivo';
  }
  return null;
}

export async function crearCategoria(input: CategoriaInput): Promise<ActionResult & { id?: string }> {
  const viewer = await requirePermiso('catalogo.gestionar');
  const error = validarCategoria(input);
  if (error) return { ok: false, message: error };

  const created = await queryOne<{ id: string }>(
    `INSERT INTO categorias_servicio (nombre, descripcion, orden_despliegue, activa)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [
      input.nombre.trim(),
      input.descripcion?.trim() || null,
      input.orden_despliegue,
      input.activa,
    ],
  );
  if (!created) return { ok: false, message: 'No pudimos crear la categoría' };

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'categoria.creada',
    entidad: 'categorias_servicio',
    entidadId: created.id,
    valorNuevo: input,
  });

  revalidatePath('/dashboard/categorias');
  return { ok: true, id: created.id };
}

export async function actualizarCategoria(
  id: string,
  input: CategoriaInput,
): Promise<ActionResult> {
  const viewer = await requirePermiso('catalogo.gestionar');
  const error = validarCategoria(input);
  if (error) return { ok: false, message: error };

  const updated = await query<{ id: string }>(
    `UPDATE categorias_servicio
     SET nombre = $1, descripcion = $2, orden_despliegue = $3, activa = $4
     WHERE id = $5
     RETURNING id`,
    [
      input.nombre.trim(),
      input.descripcion?.trim() || null,
      input.orden_despliegue,
      input.activa,
      id,
    ],
  );
  if (updated.length === 0) return { ok: false, message: 'No encontramos la categoría' };

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'categoria.actualizada',
    entidad: 'categorias_servicio',
    entidadId: id,
    valorNuevo: input,
  });

  revalidatePath('/dashboard/categorias');
  revalidatePath(`/dashboard/categorias/${id}`);
  return { ok: true };
}

export async function eliminarCategoria(id: string): Promise<ActionResult> {
  const viewer = await requirePermiso('catalogo.gestionar');

  const ref = await queryOne<{ total: string }>(
    `SELECT COUNT(*) AS total FROM servicios WHERE categoria_id = $1`,
    [id],
  );
  if (Number(ref?.total ?? 0) > 0) {
    return {
      ok: false,
      message: 'No se puede eliminar: hay servicios asociados a esta categoría',
    };
  }

  await query(`DELETE FROM categorias_servicio WHERE id = $1`, [id]);

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'categoria.eliminada',
    entidad: 'categorias_servicio',
    entidadId: id,
  });

  revalidatePath('/dashboard/categorias');
  return { ok: true };
}
