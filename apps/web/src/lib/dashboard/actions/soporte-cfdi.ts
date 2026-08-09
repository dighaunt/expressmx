'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@expressmx/validations';
import { withTransaction } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

interface ActionResult {
  ok: boolean;
  message?: string;
  tareaId?: string;
}

const CancelarInput = z.object({
  ticketId: z.string().uuid(),
  facturaId: z.string().uuid(),
  motivoSat: z.enum(['01', '02', '03', '04']),
  notas: z.string().trim().min(10).max(2000),
  uuidSustituye: z.string().trim().optional().nullable(),
});

const REEMISION_MOTIVO_LABEL = '01: Comprobante emitido con errores con relación';

export async function solicitarCancelacionCfdi(
  input: z.infer<typeof CancelarInput>,
): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.cfdi.solicitar_cancelacion');
  const parsed = CancelarInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { ticketId, facturaId, motivoSat, notas, uuidSustituye } = parsed.data;

  return await withTransaction(async (tx) => {
    const factura = await tx.queryOne<{
      id: string;
      estatus: string;
      uuid_cfdi: string | null;
      orden_id: string | null;
    }>(
      `SELECT id, estatus::text AS estatus, uuid_cfdi, orden_id
         FROM facturas WHERE id = $1`,
      [facturaId],
    );
    if (!factura) return { ok: false, message: 'Factura no encontrada' };
    if (factura.estatus !== 'timbrada') {
      return {
        ok: false,
        message: `Solo se pueden cancelar facturas timbradas (actual: ${factura.estatus})`,
      };
    }

    const yaSolicitado = await tx.queryOne<{ id: string }>(
      `SELECT id FROM tareas_caso
        WHERE ticket_id = $1
          AND tipo = 'cfdi_cancelacion'
          AND payload->>'factura_id' = $2
          AND estado IN ('abierta','en_progreso','esperando_aprobacion')`,
      [ticketId, facturaId],
    );
    if (yaSolicitado) {
      return { ok: false, message: 'Ya hay una cancelación en curso para esta factura' };
    }

    const tarea = await tx.queryOne<{ id: string }>(
      `INSERT INTO tareas_caso
         (ticket_id, tipo, asunto, descripcion_md, payload,
          grupo_asignado, creado_por, bloqueante)
       VALUES ($1, 'cfdi_cancelacion'::tipo_tarea_caso, $2, $3, $4::jsonb,
               'finanzas_l2', $5, true)
       RETURNING id`,
      [
        ticketId,
        `Cancelar CFDI ${factura.uuid_cfdi ?? facturaId.slice(0, 8)}`,
        notas,
        JSON.stringify({
          factura_id: facturaId,
          uuid_cfdi: factura.uuid_cfdi,
          motivo_sat: motivoSat,
          uuid_sustituye: uuidSustituye ?? null,
        }),
        viewer.userId,
      ],
    );
    if (!tarea) return { ok: false, message: 'No pudimos crear la tarea' };

    await tx.query(
      `UPDATE tickets_soporte
          SET action_status = 'esperando_finanzas'::action_status_ticket,
              action_status_motivo = $1,
              action_status_desde = NOW(),
              updated_at = NOW()
        WHERE id = $2`,
      [`Cancelación CFDI en curso (factura ${facturaId.slice(0, 8)})`, ticketId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.cfdi.cancelacion_solicitada',
      entidad: 'tareas_caso',
      entidadId: tarea.id,
      valorNuevo: {
        factura_id: facturaId,
        uuid_cfdi: factura.uuid_cfdi,
        motivo_sat: motivoSat,
      },
      ticketId,
    });

    revalidatePath(`/dashboard/soporte/ticket/${ticketId}`);
    revalidatePath('/dashboard/finanzas/tareas-bandeja');
    return { ok: true, tareaId: tarea.id };
  });
}

const ReemitirInput = z.object({
  ticketId: z.string().uuid(),
  facturaId: z.string().uuid(),
  notas: z.string().trim().min(10).max(2000),
  cambios: z.record(z.unknown()).optional(),
});

export async function solicitarReemisionCfdi(
  input: z.infer<typeof ReemitirInput>,
): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.cfdi.solicitar_cancelacion');
  const parsed = ReemitirInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { ticketId, facturaId, notas, cambios } = parsed.data;

  return await withTransaction(async (tx) => {
    const factura = await tx.queryOne<{
      id: string;
      estatus: string;
      uuid_cfdi: string | null;
    }>(
      `SELECT id, estatus::text AS estatus, uuid_cfdi
         FROM facturas WHERE id = $1`,
      [facturaId],
    );
    if (!factura) return { ok: false, message: 'Factura no encontrada' };
    if (factura.estatus !== 'cancelada') {
      return {
        ok: false,
        message: 'Solo se reemite si la factura está cancelada. Cancela primero.',
      };
    }

    const tarea = await tx.queryOne<{ id: string }>(
      `INSERT INTO tareas_caso
         (ticket_id, tipo, asunto, descripcion_md, payload,
          grupo_asignado, creado_por, bloqueante)
       VALUES ($1, 'cfdi_reemision'::tipo_tarea_caso, $2, $3, $4::jsonb,
               'finanzas_l2', $5, true)
       RETURNING id`,
      [
        ticketId,
        `Reemitir CFDI sustituyendo ${factura.uuid_cfdi ?? facturaId.slice(0, 8)}`,
        `${REEMISION_MOTIVO_LABEL}\n\n${notas}`,
        JSON.stringify({
          factura_id: facturaId,
          uuid_cfdi_anterior: factura.uuid_cfdi,
          cambios: cambios ?? {},
        }),
        viewer.userId,
      ],
    );
    if (!tarea) return { ok: false, message: 'No pudimos crear la tarea' };

    await tx.query(
      `UPDATE tickets_soporte
          SET action_status = 'esperando_finanzas'::action_status_ticket,
              action_status_motivo = $1,
              action_status_desde = NOW(),
              updated_at = NOW()
        WHERE id = $2`,
      [`Reemisión CFDI en curso`, ticketId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.cfdi.reemision_solicitada',
      entidad: 'tareas_caso',
      entidadId: tarea.id,
      valorNuevo: { factura_id: facturaId, uuid_cfdi_anterior: factura.uuid_cfdi },
      ticketId,
    });

    revalidatePath(`/dashboard/soporte/ticket/${ticketId}`);
    revalidatePath('/dashboard/finanzas/tareas-bandeja');
    return { ok: true, tareaId: tarea.id };
  });
}
