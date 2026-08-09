'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@expressmx/validations';
import { withTransaction } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

interface ActionResult {
  ok: boolean;
  message?: string;
  anotacionId?: string;
}

const SEVERIDAD = ['info', 'media', 'alta', 'critica'] as const;

const CrearInput = z.object({
  clienteId: z.string().uuid(),
  severidad: z.enum(SEVERIDAD),
  titulo: z.string().trim().min(3, 'Título mínimo 3 caracteres').max(120),
  cuerpo: z.string().trim().min(5, 'Detalle mínimo 5 caracteres').max(2000),
  expiraEn: z
    .string()
    .datetime({ offset: true })
    .optional()
    .nullable(),
});

export async function crearAnotacion(
  input: z.infer<typeof CrearInput>,
): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.anotacion.crear');
  const parsed = CrearInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { clienteId, severidad, titulo, cuerpo, expiraEn } = parsed.data;

  return await withTransaction(async (tx) => {
    const cliente = await tx.queryOne<{ id: string; rol: string }>(
      `SELECT id, rol::text AS rol FROM usuarios WHERE id = $1`,
      [clienteId],
    );
    if (!cliente) return { ok: false, message: 'Cliente no encontrado' };

    const row = await tx.queryOne<{ id: string }>(
      `INSERT INTO cliente_anotaciones
         (cliente_id, severidad, titulo, cuerpo_md, expira_at, creada_por)
       VALUES ($1, $2::severidad_anotacion, $3, $4, $5, $6)
       RETURNING id`,
      [clienteId, severidad, titulo, cuerpo, expiraEn ?? null, viewer.userId],
    );
    if (!row) return { ok: false, message: 'No pudimos crear la anotación' };

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.anotacion.creada',
      entidad: 'cliente_anotaciones',
      entidadId: row.id,
      valorNuevo: { cliente_id: clienteId, severidad, titulo },
    });

    revalidatePath('/dashboard/soporte');
    revalidatePath(`/dashboard/clientes/${clienteId}`);
    return { ok: true, anotacionId: row.id };
  });
}

const EliminarInput = z.object({
  anotacionId: z.string().uuid(),
  motivo: z.string().trim().min(3).max(500).optional(),
});

export async function eliminarAnotacion(
  input: z.infer<typeof EliminarInput>,
): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.anotacion.eliminar');
  const parsed = EliminarInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { anotacionId, motivo } = parsed.data;

  return await withTransaction(async (tx) => {
    const anotacion = await tx.queryOne<{
      cliente_id: string;
      eliminada_at: string | null;
    }>(
      `SELECT cliente_id, eliminada_at
         FROM cliente_anotaciones
        WHERE id = $1
        FOR UPDATE`,
      [anotacionId],
    );
    if (!anotacion) return { ok: false, message: 'Anotación no encontrada' };
    if (anotacion.eliminada_at) return { ok: true };

    await tx.query(
      `UPDATE cliente_anotaciones
          SET eliminada_at = NOW(), eliminada_por = $1
        WHERE id = $2`,
      [viewer.userId, anotacionId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.anotacion.eliminada',
      entidad: 'cliente_anotaciones',
      entidadId: anotacionId,
      valorNuevo: { motivo: motivo ?? null },
    });

    revalidatePath('/dashboard/soporte');
    revalidatePath(`/dashboard/clientes/${anotacion.cliente_id}`);
    return { ok: true };
  });
}
