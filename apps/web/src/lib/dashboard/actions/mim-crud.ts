'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@expressmx/validations';
import { withTransaction } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requireViewer } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import {
  ESTADOS_MIM_ACTIVOS,
  siguientesEstadosMim,
  type EstadoMim,
} from '@/lib/dashboard/mim-shared';

interface ActionResult<T = void> {
  ok: boolean;
  message?: string;
  data?: T;
}

const ESTADOS_VALIDOS = [
  'declarado',
  'mitigando',
  'resuelto',
  'pir_pendiente',
  'cerrado',
] as const satisfies ReadonlyArray<EstadoMim>;

const DeclarInput = z.object({
  titulo: z.string().trim().min(8, 'El título debe tener al menos 8 caracteres').max(200),
  descripcion: z
    .string()
    .trim()
    .min(20, 'La descripción debe tener al menos 20 caracteres')
    .max(4000),
  servicios_afectados: z.array(z.string().trim().min(1)).max(20).default([]),
  zonas_afectadas: z.array(z.string().uuid()).max(20).default([]),
});

export async function declararMim(
  input: z.infer<typeof DeclarInput>,
): Promise<ActionResult<{ id: string }>> {
  const viewer = await requireViewer();
  if (!tienePermiso(viewer, 'soporte.mim.declarar')) {
    return { ok: false, message: 'Sin permiso para declarar Major Incident' };
  }

  const parsed = DeclarInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.errors[0]?.message ?? 'Input inválido',
    };
  }
  const { titulo, descripcion, servicios_afectados, zonas_afectadas } = parsed.data;

  const result = await withTransaction(async (tx) => {
    const inserted = await tx.queryOne<{ id: string }>(
      `INSERT INTO major_incidents
         (titulo, descripcion, estado, declarado_por, servicios_afectados, zonas_afectadas)
       VALUES ($1, $2, 'declarado'::estado_mim, $3, $4::text[], $5::uuid[])
       RETURNING id`,
      [titulo, descripcion, viewer.userId, servicios_afectados, zonas_afectadas],
    );
    if (!inserted) return { ok: false as const, message: 'No se pudo crear el MIM' };

    await tx.query(
      `INSERT INTO major_incident_updates
         (major_incident_id, contenido_md, estado_en_momento, publicado_por)
       VALUES ($1, $2, 'declarado'::estado_mim, $3)`,
      [inserted.id, descripcion, viewer.userId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.mim.declarar',
      entidad: 'major_incidents',
      entidadId: inserted.id,
      valorNuevo: { titulo, servicios_afectados, zonas_afectadas },
    });

    return { ok: true as const, data: { id: inserted.id } };
  });

  if (result.ok) {
    revalidatePath('/dashboard/soporte');
    revalidatePath('/dashboard/soporte/mim');
  }
  return result;
}

const UpdateInput = z.object({
  mimId: z.string().uuid(),
  contenido: z
    .string()
    .trim()
    .min(20, 'El update debe tener al menos 20 caracteres')
    .max(4000),
  nuevoEstado: z.enum(ESTADOS_VALIDOS).optional(),
  pirUrl: z.string().url('URL inválida').max(500).optional(),
});

export async function publicarUpdateMim(
  input: z.infer<typeof UpdateInput>,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!tienePermiso(viewer, 'soporte.mim.publicar_update')) {
    return { ok: false, message: 'Sin permiso para publicar updates' };
  }

  const parsed = UpdateInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.errors[0]?.message ?? 'Input inválido',
    };
  }
  const { mimId, contenido, nuevoEstado, pirUrl } = parsed.data;

  const result = await withTransaction(async (tx) => {
    const mim = await tx.queryOne<{ estado: EstadoMim; pir_url: string | null }>(
      `SELECT estado::text AS estado, pir_url
         FROM major_incidents WHERE id = $1 FOR UPDATE`,
      [mimId],
    );
    if (!mim) return { ok: false as const, message: 'MIM no encontrado' };

    let estadoFinal: EstadoMim = mim.estado;
    if (nuevoEstado && nuevoEstado !== mim.estado) {
      const transiciones = siguientesEstadosMim(mim.estado);
      if (!transiciones.includes(nuevoEstado)) {
        return {
          ok: false as const,
          message: `Transición no permitida: ${mim.estado} → ${nuevoEstado}`,
        };
      }
      if (nuevoEstado === 'cerrado' && !tienePermiso(viewer, 'soporte.mim.cerrar')) {
        return { ok: false as const, message: 'Sin permiso para cerrar MIM' };
      }
      if (nuevoEstado === 'cerrado' && !pirUrl && !mim.pir_url) {
        return {
          ok: false as const,
          message: 'Para cerrar el MIM debes adjuntar el PIR URL',
        };
      }
      estadoFinal = nuevoEstado;

      const setClauses: string[] = [`estado = $2::estado_mim`];
      const args: unknown[] = [mimId, nuevoEstado];
      if (nuevoEstado === 'mitigando') {
        setClauses.push(`mitigado_at = COALESCE(mitigado_at, NOW())`);
      }
      if (nuevoEstado === 'resuelto') {
        setClauses.push(`resuelto_at = COALESCE(resuelto_at, NOW())`);
      }
      if (pirUrl) {
        args.push(pirUrl);
        setClauses.push(`pir_url = $${args.length}`);
      }
      setClauses.push(`updated_at = NOW()`);

      await tx.query(
        `UPDATE major_incidents SET ${setClauses.join(', ')} WHERE id = $1`,
        args,
      );
    }

    await tx.query(
      `INSERT INTO major_incident_updates
         (major_incident_id, contenido_md, estado_en_momento, publicado_por)
       VALUES ($1, $2, $3::estado_mim, $4)`,
      [mimId, contenido, estadoFinal, viewer.userId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.mim.publicar_update',
      entidad: 'major_incidents',
      entidadId: mimId,
      valorAnterior: { estado: mim.estado },
      valorNuevo: {
        estado: estadoFinal,
        cambio_estado: nuevoEstado !== undefined && nuevoEstado !== mim.estado,
        pir_actualizado: pirUrl !== undefined,
      },
    });

    return { ok: true as const };
  });

  if (result.ok) {
    revalidatePath(`/dashboard/soporte/mim/${mimId}`);
    revalidatePath('/dashboard/soporte/mim');
    revalidatePath('/dashboard/soporte');
  }
  return result;
}

const VincularInput = z.object({
  mimId: z.string().uuid(),
  ticketId: z.string().uuid(),
});

export async function vincularTicketAMim(
  input: z.infer<typeof VincularInput>,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!tienePermiso(viewer, 'soporte.mim.declarar')) {
    return { ok: false, message: 'Sin permiso para vincular tickets' };
  }
  const parsed = VincularInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: 'Input inválido' };
  }
  const { mimId, ticketId } = parsed.data;

  const result = await withTransaction(async (tx) => {
    const mim = await tx.queryOne<{ estado: EstadoMim }>(
      `SELECT estado::text AS estado FROM major_incidents WHERE id = $1`,
      [mimId],
    );
    if (!mim) return { ok: false as const, message: 'MIM no encontrado' };
    if (!ESTADOS_MIM_ACTIVOS.has(mim.estado)) {
      return { ok: false as const, message: 'No se vinculan tickets a MIM cerrados' };
    }

    await tx.query(
      `INSERT INTO ticket_major_incident_link
         (ticket_id, major_incident_id, vinculado_por)
       VALUES ($1, $2, $3)
       ON CONFLICT (ticket_id, major_incident_id) DO NOTHING`,
      [ticketId, mimId, viewer.userId],
    );

    await tx.query(
      `UPDATE tickets_soporte
          SET es_major_incident = TRUE, updated_at = NOW()
        WHERE id = $1`,
      [ticketId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.mim.vincular_ticket',
      entidad: 'ticket_major_incident_link',
      entidadId: ticketId,
      valorNuevo: { mim_id: mimId },
      ticketId,
    });

    return { ok: true as const };
  });

  if (result.ok) {
    revalidatePath(`/dashboard/soporte/mim/${mimId}`);
    revalidatePath(`/dashboard/soporte/ticket/${ticketId}`);
  }
  return result;
}
