'use server';

import { revalidatePath } from 'next/cache';
import { query, queryOne } from '@expressmx/database';
import { logAccionDirecta } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

interface ActionResult {
  ok: boolean;
  message?: string;
  codigo?: string;
}

const CODIGO_LENGTH = 8;
const CODIGO_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generarCodigoLocal(): string {
  let out = '';
  for (let i = 0; i < CODIGO_LENGTH; i++) {
    const idx = Math.floor(Math.random() * CODIGO_ALPHABET.length);
    out += CODIGO_ALPHABET[idx];
  }
  return out;
}

export async function generarInvitacion(
  diasVigencia: number,
  notas: string | null,
): Promise<ActionResult> {
  const viewer = await requirePermiso('prestadores.invitar');

  const dias = Math.max(1, Math.min(60, Math.floor(diasVigencia)));
  const notasTrim = notas?.trim() || null;
  if (notasTrim && notasTrim.length > 280) {
    return { ok: false, message: 'Las notas son demasiado largas (máx. 280 caracteres)' };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const codigo = generarCodigoLocal();
    try {
      const created = await queryOne<{ codigo: string }>(
        `INSERT INTO invitaciones_prestadores (codigo, creado_por, expira_en, notas)
         VALUES ($1, $2, NOW() + ($3 || ' days')::INTERVAL, $4)
         RETURNING codigo`,
        [codigo, viewer.userId, dias, notasTrim],
      );
      if (created) {
        await logAccionDirecta({
          adminId: viewer.userId,
          accion: 'invitacion.generada',
          entidad: 'invitaciones_prestadores',
          valorNuevo: { codigo: created.codigo, dias_vigencia: dias },
        });
        revalidatePath('/dashboard/invitaciones');
        return { ok: true, codigo: created.codigo };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('invitaciones_prestadores_codigo_key') || msg.includes('duplicate key')) {
        continue;
      }
      return { ok: false, message: 'No pudimos generar el código.' };
    }
  }
  return { ok: false, message: 'No pudimos generar un código único, inténtalo de nuevo.' };
}

export async function revocarInvitacion(invitacionId: string): Promise<ActionResult> {
  const viewer = await requirePermiso('prestadores.invitar');

  const updated = await queryOne<{ id: string }>(
    `UPDATE invitaciones_prestadores
     SET revocada_en = NOW(), revocada_por = $2
     WHERE id = $1
       AND revocada_en IS NULL
       AND usado_en IS NULL
     RETURNING id`,
    [invitacionId, viewer.userId],
  );
  if (!updated) {
    return {
      ok: false,
      message: 'Esta invitación ya fue usada o revocada antes',
    };
  }

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'invitacion.revocada',
    entidad: 'invitaciones_prestadores',
    entidadId: invitacionId,
  });

  revalidatePath('/dashboard/invitaciones');
  return { ok: true };
}

export async function extenderInvitacion(invitacionId: string, dias: number): Promise<ActionResult> {
  const viewer = await requirePermiso('prestadores.invitar');
  const diasInt = Math.max(1, Math.min(30, Math.floor(dias)));

  const updated = await query<{ id: string }>(
    `UPDATE invitaciones_prestadores
     SET expira_en = expira_en + ($2 || ' days')::INTERVAL
     WHERE id = $1
       AND revocada_en IS NULL
       AND usado_en IS NULL
     RETURNING id`,
    [invitacionId, diasInt],
  );
  if (updated.length === 0) {
    return { ok: false, message: 'No se puede extender: ya fue usada o revocada' };
  }

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'invitacion.extendida',
    entidad: 'invitaciones_prestadores',
    entidadId: invitacionId,
    valorNuevo: { dias_extra: diasInt },
  });

  revalidatePath('/dashboard/invitaciones');
  return { ok: true };
}
