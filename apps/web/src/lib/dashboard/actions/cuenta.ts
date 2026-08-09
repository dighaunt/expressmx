'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { withTransaction } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requireViewer } from '@/lib/dashboard/auth-gate';

interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface PerfilInput {
  nombre: string;
  apellidos: string;
  telefono: string | null;
  avatar_url: string | null;
}

const TELEFONO_REGEX = /^[0-9+()\-\s]{7,20}$/;
const URL_REGEX = /^https?:\/\/.+/i;

function validar(input: PerfilInput): string | null {
  const nombre = input.nombre.trim();
  const apellidos = input.apellidos.trim();
  if (!nombre) return 'El nombre es obligatorio';
  if (nombre.length > 80) return 'El nombre es muy largo';
  if (!apellidos) return 'Los apellidos son obligatorios';
  if (apellidos.length > 80) return 'Los apellidos son muy largos';
  if (input.telefono && !TELEFONO_REGEX.test(input.telefono.trim())) {
    return 'El teléfono tiene un formato inválido';
  }
  if (input.avatar_url && !URL_REGEX.test(input.avatar_url.trim())) {
    return 'La URL del avatar debe empezar con http:// o https://';
  }
  return null;
}

export async function actualizarPerfil(input: PerfilInput): Promise<ActionResult> {
  const viewer = await requireViewer();
  const error = validar(input);
  if (error) return { ok: false, message: error };

  await withTransaction(async (tx) => {
    await tx.query(
      `UPDATE usuarios
       SET nombre = $1,
           apellidos = $2,
           telefono = $3,
           avatar_url = $4
       WHERE id = $5`,
      [
        input.nombre.trim(),
        input.apellidos.trim(),
        input.telefono?.trim() || null,
        input.avatar_url?.trim() || null,
        viewer.userId,
      ],
    );
  });

  revalidatePath('/dashboard/cuenta');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function cambiarPassword(
  passwordActual: string,
  passwordNuevo: string,
): Promise<ActionResult> {
  const viewer = await requireViewer();

  if (!passwordActual || passwordActual.length < 6) {
    return { ok: false, message: 'Ingresa tu contraseña actual' };
  }
  if (!passwordNuevo || passwordNuevo.length < 8) {
    return { ok: false, message: 'La nueva contraseña debe tener al menos 8 caracteres' };
  }
  if (passwordNuevo === passwordActual) {
    return { ok: false, message: 'La nueva contraseña debe ser distinta a la actual' };
  }
  if (passwordNuevo.length > 128) {
    return { ok: false, message: 'La nueva contraseña es demasiado larga' };
  }

  return await withTransaction(async (tx) => {
    const credenciales = await tx.queryOne<{ password_hash: string }>(
      `SELECT password_hash FROM user_credentials WHERE user_id = $1 FOR UPDATE`,
      [viewer.userId],
    );
    if (!credenciales) {
      return { ok: false, message: 'No hay contraseña configurada para esta cuenta' };
    }

    const valido = await bcrypt.compare(passwordActual, credenciales.password_hash);
    if (!valido) {
      return { ok: false, message: 'La contraseña actual no es correcta' };
    }

    const nuevoHash = await bcrypt.hash(passwordNuevo, 12);
    await tx.query(
      `UPDATE user_credentials
       SET password_hash = $1, updated_at = NOW()
       WHERE user_id = $2`,
      [nuevoHash, viewer.userId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'cuenta.password_cambiada',
      entidad: 'user_credentials',
      entidadId: viewer.userId,
    });

    return { ok: true };
  });
}
