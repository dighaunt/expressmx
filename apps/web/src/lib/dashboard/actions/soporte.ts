'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { withTransaction } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

interface ActionResult {
  ok: boolean;
  message?: string;
}

interface AbrirCasoResult extends ActionResult {
  casoId?: string;
  clienteId?: string;
}

interface CambioPasswordResult extends ActionResult {
  nuevoPassword?: string;
}

const PIN_REGEX = /^\d{6}$/;

function nuevaPassword(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 12; i++) {
    out += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  }
  return out;
}

export async function abrirCasoConPin(
  email: string,
  pin: string,
  ticketId?: string,
): Promise<AbrirCasoResult> {
  const viewer = await requirePermiso('soporte.abrir_caso');

  if (!ticketId) {
    return {
      ok: false,
      message: 'Soporte solo puede validar identidad desde un ticket existente',
    };
  }

  const emailLower = email.trim().toLowerCase();
  const pinTrim = pin.trim();

  if (!emailLower) return { ok: false, message: 'Captura el email del cliente' };
  if (!PIN_REGEX.test(pinTrim)) return { ok: false, message: 'El PIN debe ser de 6 dígitos' };

  return await withTransaction(async (tx) => {
    const cliente = await tx.queryOne<{ id: string; rol: string; activo: boolean }>(
      `SELECT id, rol::text AS rol, activo FROM usuarios WHERE LOWER(email) = $1`,
      [emailLower],
    );
    if (!cliente) return { ok: false, message: 'No encontramos al cliente' };
    if (cliente.rol !== 'cliente') {
      return { ok: false, message: 'Esa cuenta no es de cliente' };
    }
    if (!cliente.activo) return { ok: false, message: 'La cuenta del cliente no está activa' };

    const ticket = await tx.queryOne<{ id: string }>(
      `SELECT id
       FROM tickets_soporte
       WHERE id = $1
         AND usuario_id = $2
         AND estatus IN ('abierto', 'en_revision', 'escalado')
       LIMIT 1`,
      [ticketId, cliente.id],
    );
    if (!ticket) {
      return {
        ok: false,
        message: 'El PIN solo se puede asociar a un ticket activo de ese cliente',
      };
    }

    const pins = await tx.query<{ id: string; pin_hash: string }>(
      `SELECT id, pin_hash
       FROM pins_soporte_cliente
       WHERE cliente_id = $1
         AND usado_en IS NULL
         AND expira_en > NOW()
       ORDER BY generado_en DESC
       LIMIT 5
       FOR UPDATE`,
      [cliente.id],
    );

    if (pins.length === 0) {
      return {
        ok: false,
        message:
          'El cliente no tiene un PIN vigente. Pídele que genere uno desde su app y vuelve a intentarlo.',
      };
    }

    let pinValido: { id: string } | null = null;
    for (const p of pins) {
      const ok = await bcrypt.compare(pinTrim, p.pin_hash);
      if (ok) {
        pinValido = { id: p.id };
        break;
      }
    }

    if (!pinValido) {
      return { ok: false, message: 'El PIN no coincide' };
    }

    await tx.query(
      `UPDATE pins_soporte_cliente
       SET usado_en = NOW(), usado_por = $1
       WHERE id = $2`,
      [viewer.userId, pinValido.id],
    );

    const caso = await tx.queryOne<{ id: string }>(
      `INSERT INTO casos_soporte_abiertos (agente_id, cliente_id, pin_id, ticket_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [viewer.userId, cliente.id, pinValido.id, ticketId],
    );

    if (!caso) return { ok: false, message: 'No pudimos abrir el caso' };

    const verif = await tx.queryOne<{ id: string }>(
      `INSERT INTO verificaciones_identidad_cliente
         (cliente_id, ticket_id, pin_id, metodo, verificado_por)
       VALUES ($1, $2, $3, 'pin', $4)
       RETURNING id`,
      [cliente.id, ticketId ?? null, pinValido.id, viewer.userId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.caso_abierto',
      entidad: 'casos_soporte_abiertos',
      entidadId: caso.id,
      valorNuevo: {
        cliente_id: cliente.id,
        cliente_email: emailLower,
        verificacion_id: verif?.id ?? null,
        ticket_id: ticketId ?? null,
      },
      casoId: caso.id,
      ticketId: ticketId ?? null,
    });

    revalidatePath('/dashboard/soporte');
    return { ok: true, casoId: caso.id, clienteId: cliente.id };
  });
}

export async function cerrarCaso(casoId: string, motivo: string): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.abrir_caso');
  const motivoTrim = motivo.trim();
  if (motivoTrim.length < 3) {
    return { ok: false, message: 'Describe brevemente cómo se cerró el caso' };
  }

  return await withTransaction(async (tx) => {
    const target = await tx.queryOne<{ agente_id: string; cerrado_en: string | null }>(
      `SELECT agente_id, cerrado_en FROM casos_soporte_abiertos WHERE id = $1 FOR UPDATE`,
      [casoId],
    );
    if (!target) return { ok: false, message: 'Caso no encontrado' };
    if (target.agente_id !== viewer.userId) {
      return { ok: false, message: 'Este caso pertenece a otro agente' };
    }
    if (target.cerrado_en) return { ok: true };

    await tx.query(
      `UPDATE casos_soporte_abiertos
       SET cerrado_en = NOW(), motivo_cierre = $1
       WHERE id = $2`,
      [motivoTrim, casoId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.caso_cerrado',
      entidad: 'casos_soporte_abiertos',
      entidadId: casoId,
      valorNuevo: { motivo: motivoTrim },
      casoId,
    });

    revalidatePath('/dashboard/soporte');
    return { ok: true };
  });
}

export async function forzarCambioPassword(casoId: string): Promise<CambioPasswordResult> {
  const viewer = await requirePermiso('usuarios.cambiar_password');

  return await withTransaction(async (tx) => {
    const caso = await tx.queryOne<{ cliente_id: string }>(
      `SELECT cliente_id FROM casos_soporte_abiertos
       WHERE id = $1
         AND agente_id = $2
         AND cerrado_en IS NULL
         AND expira_en > NOW()
       FOR UPDATE`,
      [casoId, viewer.userId],
    );
    if (!caso) {
      return {
        ok: false,
        message: 'Necesitas un caso activo de este cliente para forzar el cambio',
      };
    }

    const password = nuevaPassword();
    const hash = await bcrypt.hash(password, 12);

    await tx.query(
      `INSERT INTO user_credentials (user_id, password_hash, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = NOW()`,
      [caso.cliente_id, hash],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'cliente.password_forzada',
      entidad: 'user_credentials',
      entidadId: caso.cliente_id,
      casoId,
    });

    revalidatePath('/dashboard/soporte');
    return { ok: true, nuevoPassword: password };
  });
}
