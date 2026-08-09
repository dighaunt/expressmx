'use server';

import { revalidatePath } from 'next/cache';
import { query, queryOne, withTransaction } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface RolInput {
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

const NOMBRE_PROTEGIDO = new Set(['super_admin']);
const NOMBRE_REGEX = /^[a-z][a-z0-9_]{1,30}$/;

function validar(input: RolInput): string | null {
  const nombre = input.nombre.trim();
  if (!nombre) return 'El identificador es obligatorio';
  if (!NOMBRE_REGEX.test(nombre)) {
    return 'Usa solo minúsculas, números y guion bajo. Empieza con letra. Máximo 31.';
  }
  if (input.descripcion && input.descripcion.length > 240) {
    return 'La descripción es muy larga';
  }
  return null;
}

export async function crearRol(input: RolInput): Promise<ActionResult & { id?: string }> {
  const viewer = await requirePermiso('roles.gestionar');
  const error = validar(input);
  if (error) return { ok: false, message: error };

  const nombre = input.nombre.trim();
  if (NOMBRE_PROTEGIDO.has(nombre)) {
    return { ok: false, message: 'Ese identificador está reservado' };
  }

  return await withTransaction(async (tx) => {
    const exists = await tx.queryOne<{ id: string }>(
      `SELECT id FROM roles_admin WHERE nombre = $1`,
      [nombre],
    );
    if (exists) return { ok: false, message: 'Ya existe un rol con ese identificador' };

    const created = await tx.queryOne<{ id: string }>(
      `INSERT INTO roles_admin (nombre, descripcion, activo)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [nombre, input.descripcion?.trim() || null, input.activo],
    );
    if (!created) return { ok: false, message: 'No pudimos crear el rol' };

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'rol.creado',
      entidad: 'roles_admin',
      entidadId: created.id,
      valorNuevo: { nombre, descripcion: input.descripcion ?? null, activo: input.activo },
    });

    revalidatePath('/dashboard/roles');
    return { ok: true, id: created.id };
  });
}

export async function actualizarRol(id: string, input: RolInput): Promise<ActionResult> {
  const viewer = await requirePermiso('roles.gestionar');
  const error = validar(input);
  if (error) return { ok: false, message: error };

  const nombre = input.nombre.trim();

  return await withTransaction(async (tx) => {
    const target = await tx.queryOne<{
      nombre: string;
      descripcion: string | null;
      activo: boolean;
    }>(
      `SELECT nombre, descripcion, activo FROM roles_admin WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!target) return { ok: false, message: 'No encontramos el rol' };

    if (NOMBRE_PROTEGIDO.has(target.nombre) && target.nombre !== nombre) {
      return { ok: false, message: 'No se puede renombrar un rol del sistema' };
    }
    if (NOMBRE_PROTEGIDO.has(target.nombre) && !input.activo) {
      return { ok: false, message: 'No se puede desactivar un rol del sistema' };
    }

    const collision = await tx.queryOne<{ id: string }>(
      `SELECT id FROM roles_admin WHERE nombre = $1 AND id <> $2`,
      [nombre, id],
    );
    if (collision) return { ok: false, message: 'Ya existe un rol con ese identificador' };

    await tx.query(
      `UPDATE roles_admin
       SET nombre = $1, descripcion = $2, activo = $3
       WHERE id = $4`,
      [nombre, input.descripcion?.trim() || null, input.activo, id],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'rol.actualizado',
      entidad: 'roles_admin',
      entidadId: id,
      valorAnterior: target,
      valorNuevo: { nombre, descripcion: input.descripcion ?? null, activo: input.activo },
    });

    revalidatePath('/dashboard/roles');
    revalidatePath(`/dashboard/roles/${id}`);
    return { ok: true };
  });
}

export async function togglePermiso(
  rolId: string,
  permisoClave: string,
  asignar: boolean,
): Promise<ActionResult> {
  const viewer = await requirePermiso('roles.gestionar');

  return await withTransaction(async (tx) => {
    const rol = await tx.queryOne<{ nombre: string }>(
      `SELECT nombre FROM roles_admin WHERE id = $1 FOR UPDATE`,
      [rolId],
    );
    if (!rol) return { ok: false, message: 'No encontramos el rol' };
    if (NOMBRE_PROTEGIDO.has(rol.nombre)) {
      return { ok: false, message: 'super_admin tiene todos los permisos por diseño' };
    }

    const permiso = await tx.queryOne<{ id: string }>(
      `SELECT id FROM permisos WHERE clave = $1`,
      [permisoClave],
    );
    if (!permiso) return { ok: false, message: 'Permiso no reconocido' };

    if (asignar) {
      await tx.query(
        `INSERT INTO roles_permisos (rol_id, permiso_id)
         VALUES ($1, $2)
         ON CONFLICT (rol_id, permiso_id) DO NOTHING`,
        [rolId, permiso.id],
      );
    } else {
      await tx.query(
        `DELETE FROM roles_permisos WHERE rol_id = $1 AND permiso_id = $2`,
        [rolId, permiso.id],
      );
    }

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: asignar ? 'rol.permiso_asignado' : 'rol.permiso_removido',
      entidad: 'roles_permisos',
      entidadId: rolId,
      valorNuevo: { rol: rol.nombre, permiso: permisoClave },
    });

    revalidatePath(`/dashboard/roles/${rolId}`);
    return { ok: true };
  });
}

export async function eliminarRol(id: string): Promise<ActionResult> {
  const viewer = await requirePermiso('roles.gestionar');

  return await withTransaction(async (tx) => {
    const target = await tx.queryOne<{ nombre: string }>(
      `SELECT nombre FROM roles_admin WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!target) return { ok: false, message: 'No encontramos el rol' };
    if (NOMBRE_PROTEGIDO.has(target.nombre)) {
      return { ok: false, message: 'No se puede eliminar un rol del sistema' };
    }

    const ref = await tx.queryOne<{ total: string }>(
      `SELECT COUNT(*) AS total FROM usuarios_admin WHERE rol_id = $1 AND activo = TRUE`,
      [id],
    );
    if (Number(ref?.total ?? 0) > 0) {
      return {
        ok: false,
        message: 'No se puede eliminar: hay administradores activos asignados a este rol',
      };
    }

    await tx.query(`DELETE FROM roles_permisos WHERE rol_id = $1`, [id]);
    await tx.query(`DELETE FROM roles_admin WHERE id = $1`, [id]);

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'rol.eliminado',
      entidad: 'roles_admin',
      entidadId: id,
      valorAnterior: { nombre: target.nombre },
    });

    revalidatePath('/dashboard/roles');
    return { ok: true };
  });
}

export async function asignarPermisosBulk(
  rolId: string,
  claves: string[],
): Promise<ActionResult> {
  const viewer = await requirePermiso('roles.gestionar');

  return await withTransaction(async (tx) => {
    const rol = await tx.queryOne<{ nombre: string }>(
      `SELECT nombre FROM roles_admin WHERE id = $1 FOR UPDATE`,
      [rolId],
    );
    if (!rol) return { ok: false, message: 'No encontramos el rol' };
    if (NOMBRE_PROTEGIDO.has(rol.nombre)) {
      return { ok: false, message: 'super_admin tiene todos los permisos por diseño' };
    }

    const previas = await tx.query<{ clave: string }>(
      `SELECT p.clave FROM roles_permisos rp JOIN permisos p ON p.id = rp.permiso_id WHERE rp.rol_id = $1`,
      [rolId],
    );

    const ids = await tx.query<{ id: string }>(
      `SELECT id FROM permisos WHERE clave = ANY($1::text[])`,
      [claves],
    );
    const permisoIds = ids.map((r) => r.id);

    await tx.query(`DELETE FROM roles_permisos WHERE rol_id = $1`, [rolId]);
    if (permisoIds.length > 0) {
      const placeholders = permisoIds.map((_, i) => `($1, $${i + 2})`).join(', ');
      await tx.query(
        `INSERT INTO roles_permisos (rol_id, permiso_id) VALUES ${placeholders}`,
        [rolId, ...permisoIds],
      );
    }

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'rol.permisos_bulk_actualizados',
      entidad: 'roles_permisos',
      entidadId: rolId,
      valorAnterior: { permisos: previas.map((p) => p.clave) },
      valorNuevo: { permisos: claves },
    });

    revalidatePath(`/dashboard/roles/${rolId}`);
    return { ok: true };
  });
}
