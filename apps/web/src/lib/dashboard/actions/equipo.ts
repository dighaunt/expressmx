'use server';

import { revalidatePath } from 'next/cache';
import { withTransaction } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import {
  buscarUsuariosParaAdmin,
  type UsuarioBuscado,
} from '@/lib/dashboard/queries/equipo';

interface ActionResult {
  ok: boolean;
  message?: string;
  adminId?: string;
}

export async function buscarUsuarios(termino: string): Promise<UsuarioBuscado[]> {
  await requirePermiso('roles.gestionar');
  return buscarUsuariosParaAdmin(termino);
}

export async function asignarAdmin(
  usuarioId: string,
  rolId: string,
): Promise<ActionResult> {
  const viewer = await requirePermiso('roles.gestionar');

  return await withTransaction(async (tx) => {
    const usuario = await tx.queryOne<{ id: string; activo: boolean; rol: string }>(
      `SELECT id, activo, rol::text AS rol FROM usuarios WHERE id = $1 FOR UPDATE`,
      [usuarioId],
    );
    if (!usuario) return { ok: false, message: 'Usuario no encontrado' };
    if (!usuario.activo) return { ok: false, message: 'El usuario no está activo' };
    if (usuario.rol !== 'admin') {
      return {
        ok: false,
        message:
          'Solo usuarios con rol admin pueden tener acceso al panel. Crea una cuenta admin nueva si esa persona también opera como cliente o prestador.',
      };
    }

    const rol = await tx.queryOne<{ id: string; activo: boolean }>(
      `SELECT id, activo FROM roles_admin WHERE id = $1`,
      [rolId],
    );
    if (!rol) return { ok: false, message: 'Rol no encontrado' };
    if (!rol.activo) return { ok: false, message: 'El rol no está activo' };

    const existing = await tx.queryOne<{ id: string; activo: boolean }>(
      `SELECT id, activo FROM usuarios_admin WHERE usuario_id = $1 FOR UPDATE`,
      [usuarioId],
    );

    if (existing) {
      await tx.query(
        `UPDATE usuarios_admin
         SET rol_id = $1, activo = TRUE
         WHERE id = $2`,
        [rolId, existing.id],
      );
      await logAccion(tx, {
        adminId: viewer.userId,
        accion: 'admin.acceso_reasignado',
        entidad: 'usuarios_admin',
        entidadId: existing.id,
        valorNuevo: { usuario_id: usuarioId, rol_id: rolId },
      });
      revalidatePath('/dashboard/equipo');
      revalidatePath(`/dashboard/equipo/${existing.id}`);
      return { ok: true, adminId: existing.id };
    }

    const created = await tx.queryOne<{ id: string }>(
      `INSERT INTO usuarios_admin (usuario_id, rol_id, activo)
       VALUES ($1, $2, TRUE)
       RETURNING id`,
      [usuarioId, rolId],
    );
    if (!created) return { ok: false, message: 'No pudimos crear el acceso' };

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'admin.acceso_asignado',
      entidad: 'usuarios_admin',
      entidadId: created.id,
      valorNuevo: { usuario_id: usuarioId, rol_id: rolId },
    });

    revalidatePath('/dashboard/equipo');
    return { ok: true, adminId: created.id };
  });
}

export async function cambiarRolAdmin(adminId: string, rolId: string): Promise<ActionResult> {
  const viewer = await requirePermiso('roles.gestionar');

  return await withTransaction(async (tx) => {
    const target = await tx.queryOne<{ id: string; rol_id: string }>(
      `SELECT id, rol_id FROM usuarios_admin WHERE id = $1 FOR UPDATE`,
      [adminId],
    );
    if (!target) return { ok: false, message: 'Acceso no encontrado' };

    const rol = await tx.queryOne<{ id: string; activo: boolean }>(
      `SELECT id, activo FROM roles_admin WHERE id = $1`,
      [rolId],
    );
    if (!rol) return { ok: false, message: 'Rol no encontrado' };
    if (!rol.activo) return { ok: false, message: 'El rol no está activo' };

    await tx.query(`UPDATE usuarios_admin SET rol_id = $1 WHERE id = $2`, [
      rolId,
      adminId,
    ]);

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'admin.rol_cambiado',
      entidad: 'usuarios_admin',
      entidadId: adminId,
      valorAnterior: { rol_id: target.rol_id },
      valorNuevo: { rol_id: rolId },
    });

    revalidatePath('/dashboard/equipo');
    revalidatePath(`/dashboard/equipo/${adminId}`);
    return { ok: true };
  });
}

export async function desactivarAdmin(adminId: string): Promise<ActionResult> {
  const viewer = await requirePermiso('roles.gestionar');

  return await withTransaction(async (tx) => {
    const target = await tx.queryOne<{ id: string; usuario_id: string; activo: boolean }>(
      `SELECT id, usuario_id, activo FROM usuarios_admin WHERE id = $1 FOR UPDATE`,
      [adminId],
    );
    if (!target) return { ok: false, message: 'Acceso no encontrado' };
    if (target.usuario_id === viewer.userId) {
      return { ok: false, message: 'No puedes desactivar tu propio acceso' };
    }
    if (!target.activo) return { ok: true };

    await tx.query(`UPDATE usuarios_admin SET activo = FALSE WHERE id = $1`, [adminId]);

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'admin.acceso_suspendido',
      entidad: 'usuarios_admin',
      entidadId: adminId,
      valorAnterior: { usuario_id: target.usuario_id },
    });

    revalidatePath('/dashboard/equipo');
    revalidatePath(`/dashboard/equipo/${adminId}`);
    return { ok: true };
  });
}

export async function reactivarAdmin(adminId: string): Promise<ActionResult> {
  const viewer = await requirePermiso('roles.gestionar');

  return await withTransaction(async (tx) => {
    const target = await tx.queryOne<{ id: string; rol_id: string; activo: boolean }>(
      `SELECT id, rol_id, activo FROM usuarios_admin WHERE id = $1 FOR UPDATE`,
      [adminId],
    );
    if (!target) return { ok: false, message: 'Acceso no encontrado' };
    if (target.activo) return { ok: true };

    const rol = await tx.queryOne<{ activo: boolean }>(
      `SELECT activo FROM roles_admin WHERE id = $1`,
      [target.rol_id],
    );
    if (!rol?.activo) {
      return {
        ok: false,
        message: 'El rol asignado está inactivo. Cámbialo antes de reactivar.',
      };
    }

    await tx.query(`UPDATE usuarios_admin SET activo = TRUE WHERE id = $1`, [adminId]);

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'admin.acceso_reactivado',
      entidad: 'usuarios_admin',
      entidadId: adminId,
      valorNuevo: { rol_id: target.rol_id },
    });

    revalidatePath('/dashboard/equipo');
    revalidatePath(`/dashboard/equipo/${adminId}`);
    return { ok: true };
  });
}
