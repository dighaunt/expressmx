'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@expressmx/validations';
import { withTransaction, type Tx } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { getAssignmentBlocker } from '@/lib/provider/assignment';

interface ActionResult {
  ok: boolean;
  message?: string;
}

const MarcarInput = z.object({
  tareaId: z.string().uuid(),
});

export async function marcarEnProgreso(
  input: z.infer<typeof MarcarInput>,
): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.tarea.completar');
  const parsed = MarcarInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { tareaId } = parsed.data;

  return await withTransaction(async (tx) => {
    const tarea = await tx.queryOne<{
      ticket_id: string;
      estado: string;
      asignado_a: string | null;
    }>(
      `SELECT ticket_id, estado::text AS estado, asignado_a
         FROM tareas_caso WHERE id = $1 FOR UPDATE`,
      [tareaId],
    );
    if (!tarea) return { ok: false, message: 'Tarea no encontrada' };
    if (tarea.estado !== 'abierta') {
      return { ok: false, message: `No se puede mover a en_progreso desde ${tarea.estado}` };
    }

    await tx.query(
      `UPDATE tareas_caso
          SET estado = 'en_progreso',
              asignado_a = COALESCE(asignado_a, $1),
              updated_at = NOW()
        WHERE id = $2`,
      [viewer.userId, tareaId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.tarea.en_progreso',
      entidad: 'tareas_caso',
      entidadId: tareaId,
      valorAnterior: { estado: tarea.estado },
      valorNuevo: { estado: 'en_progreso' },
      ticketId: tarea.ticket_id,
    });

    revalidatePath(`/dashboard/soporte/ticket/${tarea.ticket_id}`);
    revalidatePath('/dashboard/finanzas/tareas-bandeja');
    revalidatePath('/dashboard/operaciones/tareas-bandeja');
    return { ok: true };
  });
}

const PayloadEjecucion = z.object({
  acuseSat: z.string().trim().min(3).max(200).optional(),
  prestadorNuevoId: z.string().uuid().optional(),
  referenciaPago: z.string().trim().min(1).max(200).optional(),
  ventanaFinOverride: z.string().datetime({ offset: true }).optional(),
});

const CompletarInput = z.object({
  tareaId: z.string().uuid(),
  resultado: z.string().trim().min(5, 'Describe brevemente el resultado').max(2000),
  payloadEjecucion: PayloadEjecucion.optional(),
});

interface TareaCompleta {
  id: string;
  ticket_id: string;
  tipo: string;
  estado: string;
  asignado_a: string | null;
  grupo_asignado: string;
  payload: Record<string, unknown>;
  creado_por: string;
}

async function aplicarSideEffects(
  tx: Tx,
  tarea: TareaCompleta,
  viewerId: string,
  payloadEjecucion: z.infer<typeof PayloadEjecucion> | undefined,
): Promise<{ ok: boolean; message?: string; correlacionId: string }> {
  const correlacionId = (tarea.payload['correlacion_id'] as string | undefined) ?? tarea.id;

  if (tarea.tipo === 'credito_aplicacion') {
    const clienteId = tarea.payload['cliente_id'] as string | undefined;
    const monto = Number(tarea.payload['monto']);
    const tipoMov = (tarea.payload['tipo'] as string | undefined) ?? 'credito_compensacion';
    if (!clienteId || !Number.isFinite(monto) || monto <= 0) {
      return { ok: false, message: 'Payload de crédito inválido', correlacionId };
    }
    const mov = await tx.queryOne<{ id: string }>(
      `INSERT INTO saldo_cliente_movimientos
         (cliente_id, tipo, monto_mxn, motivo_md, ticket_id, creado_por)
       VALUES ($1, $2::tipo_movimiento_saldo, $3, $4, $5, $6)
       RETURNING id`,
      [
        clienteId,
        tipoMov,
        monto,
        `Crédito aplicado tras aprobación de tarea ${tarea.id}`,
        tarea.ticket_id,
        viewerId,
      ],
    );
    if (!mov) return { ok: false, message: 'No pudimos aplicar el crédito', correlacionId };

    await logAccion(tx, {
      adminId: viewerId,
      accion: 'soporte.credito.aplicado_via_tarea',
      entidad: 'saldo_cliente_movimientos',
      entidadId: mov.id,
      valorNuevo: {
        cliente_id: clienteId,
        monto,
        tipo: tipoMov,
        tarea_id: tarea.id,
        correlacion_id: correlacionId,
      },
      ticketId: tarea.ticket_id,
    });
    return { ok: true, correlacionId };
  }

  if (tarea.tipo === 'reasignar_prestador') {
    const ordenId = tarea.payload['orden_id'] as string | undefined;
    const prestadorNuevoId = payloadEjecucion?.prestadorNuevoId;
    if (!ordenId) return { ok: false, message: 'Payload de reasignación sin orden_id', correlacionId };
    if (!prestadorNuevoId) {
      return { ok: false, message: 'Indica el prestador nuevo en el formulario', correlacionId };
    }
    const orden = await tx.queryOne<{ id: string; estatus: string; prestador_id: string | null }>(
      `SELECT id, estatus::text AS estatus, prestador_id
         FROM ordenes_servicio WHERE id = $1 FOR UPDATE`,
      [ordenId],
    );
    if (!orden) return { ok: false, message: 'Orden no encontrada', correlacionId };
    if (!['solicitada', 'asignada', 'en_camino'].includes(orden.estatus)) {
      return {
        ok: false,
        message: `No se puede reasignar prestador en estatus "${orden.estatus}"`,
        correlacionId,
      };
    }
    const blocker = await getAssignmentBlocker(tx, ordenId, prestadorNuevoId);
    if (blocker) return { ok: false, message: blocker, correlacionId };

    await tx.query(
      `UPDATE ordenes_servicio
          SET prestador_id = $1,
              estatus = 'asignada',
              updated_at = NOW()
        WHERE id = $2`,
      [prestadorNuevoId, ordenId],
    );

    await logAccion(tx, {
      adminId: viewerId,
      accion: 'soporte.reasignar_prestador.ejecutado',
      entidad: 'ordenes_servicio',
      entidadId: ordenId,
      valorAnterior: { prestador_id: orden.prestador_id, estatus: orden.estatus },
      valorNuevo: {
        prestador_id: prestadorNuevoId,
        estatus: 'asignada',
        tarea_id: tarea.id,
        correlacion_id: correlacionId,
      },
      ticketId: tarea.ticket_id,
    });
    return { ok: true, correlacionId };
  }

  if (tarea.tipo === 'cfdi_cancelacion' || tarea.tipo === 'cfdi_reemision') {
    if (!payloadEjecucion?.acuseSat) {
      return { ok: false, message: 'Captura el folio de acuse SAT', correlacionId };
    }
    return { ok: true, correlacionId };
  }

  if (
    tarea.tipo === 'follow_up_interno' &&
    tarea.payload['subtipo'] === 'suspension_pendiente'
  ) {
    const usuarioId = tarea.payload['usuario_id'] as string | undefined;
    const motivo = tarea.payload['motivo'] as string | undefined;
    const ventanaFinPayload = tarea.payload['ventana_fin'] as string | null | undefined;
    const ventanaFin = payloadEjecucion?.ventanaFinOverride ?? ventanaFinPayload ?? null;
    if (!usuarioId || !motivo) {
      return { ok: false, message: 'Payload de suspensión inválido', correlacionId };
    }
    const u = await tx.queryOne<{ id: string; activo: boolean }>(
      `SELECT id, activo FROM usuarios WHERE id = $1 FOR UPDATE`,
      [usuarioId],
    );
    if (!u) return { ok: false, message: 'Usuario no encontrado', correlacionId };
    if (!u.activo) {
      return { ok: false, message: 'El usuario ya está inactivo', correlacionId };
    }
    const yaActiva = await tx.queryOne<{ id: string }>(
      `SELECT id FROM suspensiones_cuenta
        WHERE usuario_id = $1 AND reactivada_at IS NULL`,
      [usuarioId],
    );
    if (yaActiva) {
      return { ok: false, message: 'Ya hay una suspensión activa', correlacionId };
    }
    const susp = await tx.queryOne<{ id: string }>(
      `INSERT INTO suspensiones_cuenta
         (usuario_id, motivo, notas_md, ticket_id,
          ventana_inicio, ventana_fin, creada_por)
       VALUES ($1, $2::motivo_suspension, $3, $4, NOW(), $5, $6)
       RETURNING id`,
      [usuarioId, motivo, `Aprobada vía tarea ${tarea.id}`, tarea.ticket_id, ventanaFin, viewerId],
    );
    if (!susp) {
      return { ok: false, message: 'No pudimos crear la suspensión', correlacionId };
    }

    await logAccion(tx, {
      adminId: viewerId,
      accion: 'soporte.suspension.aprobada_y_creada',
      entidad: 'suspensiones_cuenta',
      entidadId: susp.id,
      valorNuevo: {
        usuario_id: usuarioId,
        motivo,
        tarea_id: tarea.id,
        correlacion_id: correlacionId,
      },
      ticketId: tarea.ticket_id,
    });
    return { ok: true, correlacionId };
  }

  return { ok: true, correlacionId };
}

export async function completarTareaConSideEffects(
  input: z.infer<typeof CompletarInput>,
): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.tarea.completar');
  const parsed = CompletarInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { tareaId, resultado, payloadEjecucion } = parsed.data;

  return await withTransaction(async (tx) => {
    const tarea = await tx.queryOne<TareaCompleta>(
      `SELECT id, ticket_id, tipo::text AS tipo, estado::text AS estado,
              asignado_a, grupo_asignado, payload, creado_por
         FROM tareas_caso
        WHERE id = $1
        FOR UPDATE`,
      [tareaId],
    );
    if (!tarea) return { ok: false, message: 'Tarea no encontrada' };
    if (tarea.estado === 'completada' || tarea.estado === 'cancelada') {
      return { ok: false, message: 'La tarea ya fue cerrada' };
    }

    const isOwner = tarea.asignado_a === viewer.userId;
    const isSuperAdmin = tienePermiso(viewer, 'roles.gestionar');
    const isGrupoFinanzas =
      tarea.grupo_asignado.startsWith('finanzas') && tienePermiso(viewer, 'finanzas.ver');
    const isGrupoOperaciones =
      tarea.grupo_asignado.startsWith('operaciones') &&
      (tienePermiso(viewer, 'ordenes.editar') || tienePermiso(viewer, 'ordenes.reasignar'));
    if (!isOwner && !isSuperAdmin && !isGrupoFinanzas && !isGrupoOperaciones) {
      return {
        ok: false,
        message: 'No tienes permiso para completar esta tarea',
      };
    }

    const sideEffects = await aplicarSideEffects(tx, tarea, viewer.userId, payloadEjecucion);
    if (!sideEffects.ok) {
      return { ok: false, message: sideEffects.message ?? 'No pudimos aplicar la tarea' };
    }

    const resultadoFinal = payloadEjecucion?.acuseSat
      ? `${resultado}\n\nAcuse SAT: ${payloadEjecucion.acuseSat}`
      : payloadEjecucion?.referenciaPago
        ? `${resultado}\n\nReferencia: ${payloadEjecucion.referenciaPago}`
        : resultado;

    await tx.query(
      `UPDATE tareas_caso
          SET estado = 'completada',
              completada_at = NOW(),
              completada_por = $1,
              resultado_md = $2,
              updated_at = NOW()
        WHERE id = $3`,
      [viewer.userId, resultadoFinal, tareaId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.tarea.completada',
      entidad: 'tareas_caso',
      entidadId: tareaId,
      valorAnterior: { estado: tarea.estado },
      valorNuevo: {
        estado: 'completada',
        tipo: tarea.tipo,
        correlacion_id: sideEffects.correlacionId,
      },
      ticketId: tarea.ticket_id,
    });

    const motivoMatchPatterns = [
      `cfdi:${tareaId}`,
      `reasignar:${tareaId}`,
      `credito:${tareaId}`,
      `suspension:${tareaId}`,
    ];
    await tx.query(
      `UPDATE tickets_soporte
          SET action_status = 'ninguno'::action_status_ticket,
              action_status_motivo = NULL,
              action_status_desde = NULL,
              updated_at = NOW()
        WHERE id = $1
          AND (
            action_status_motivo = ANY($2::text[])
            OR action_status_motivo LIKE 'Reembolso%'
            OR action_status_motivo LIKE 'Crédito%'
            OR action_status_motivo LIKE 'Cancelación CFDI%'
            OR action_status_motivo LIKE 'Reemisión CFDI%'
            OR action_status_motivo LIKE 'Reasignación%'
          )`,
      [tarea.ticket_id, motivoMatchPatterns],
    );

    revalidatePath(`/dashboard/soporte/ticket/${tarea.ticket_id}`);
    revalidatePath('/dashboard/finanzas/tareas-bandeja');
    revalidatePath('/dashboard/operaciones/tareas-bandeja');
    return { ok: true };
  });
}
