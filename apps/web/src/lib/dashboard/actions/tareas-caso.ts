'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@expressmx/validations';
import { withTransaction } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requirePermiso, requireViewer } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';

interface ActionResult {
  ok: boolean;
  message?: string;
  tareaId?: string;
}

const TIPO_TAREA = [
  'reembolso',
  'cfdi_cancelacion',
  'cfdi_reemision',
  'credito_aplicacion',
  'reasignar_prestador',
  'investigacion_pago',
  'callback_cliente',
  'verificacion_id',
  'follow_up_interno',
] as const;

const GRUPO_DEFAULT_POR_TIPO: Record<(typeof TIPO_TAREA)[number], string> = {
  reembolso: 'finanzas_l2',
  cfdi_cancelacion: 'finanzas_l2',
  cfdi_reemision: 'finanzas_l2',
  credito_aplicacion: 'finanzas_l2',
  reasignar_prestador: 'operaciones_l1',
  investigacion_pago: 'finanzas_l2',
  callback_cliente: 'soporte_l1',
  verificacion_id: 'soporte_l1',
  follow_up_interno: 'soporte_l1',
};

const CrearInput = z
  .object({
    ticketId: z.string().uuid(),
    tipo: z.enum(TIPO_TAREA),
    asunto: z.string().trim().min(3, 'Asunto mínimo 3 caracteres').max(160),
    descripcion: z.string().trim().min(5).max(2000).optional(),
    payload: z.record(z.unknown()).optional(),
    asignadoA: z.string().uuid().optional().nullable(),
    grupoAsignado: z.string().trim().min(2).max(60).optional(),
    bloqueante: z.boolean().optional(),
    venceEn: z.string().datetime({ offset: true }).optional().nullable(),
    visibleCliente: z.boolean().optional(),
    tituloCliente: z.string().trim().min(3).max(160).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.visibleCliente === true) {
      const titulo = value.tituloCliente?.trim();
      if (!titulo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tituloCliente'],
          message: 'Título visible al cliente es obligatorio cuando la tarea es visible',
        });
      }
    }
  });

export async function crearTarea(
  input: z.infer<typeof CrearInput>,
): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.tarea.crear');
  const parsed = CrearInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const {
    ticketId,
    tipo,
    asunto,
    descripcion,
    payload,
    asignadoA,
    grupoAsignado,
    bloqueante,
    venceEn,
    visibleCliente,
    tituloCliente,
  } = parsed.data;

  const grupo = grupoAsignado ?? GRUPO_DEFAULT_POR_TIPO[tipo];
  const visible = visibleCliente === true;
  const tituloClienteFinal = visible ? (tituloCliente ?? '').trim() : null;

  return await withTransaction(async (tx) => {
    const ticket = await tx.queryOne<{ id: string; estatus: string }>(
      `SELECT id, estatus::text AS estatus
         FROM tickets_soporte
        WHERE id = $1`,
      [ticketId],
    );
    if (!ticket) return { ok: false, message: 'Ticket no encontrado' };
    if (ticket.estatus === 'resuelto' || ticket.estatus === 'cerrado') {
      return { ok: false, message: 'No se pueden agregar tareas a un ticket cerrado' };
    }

    if (asignadoA) {
      const asignado = await tx.queryOne<{ id: string; rol: string }>(
        `SELECT id, rol::text AS rol FROM usuarios WHERE id = $1`,
        [asignadoA],
      );
      if (!asignado) return { ok: false, message: 'Usuario asignado no existe' };
      if (asignado.rol === 'cliente' || asignado.rol === 'prestador') {
        return { ok: false, message: 'Solo personal interno puede recibir tareas' };
      }
    }

    const row = await tx.queryOne<{ id: string }>(
      `INSERT INTO tareas_caso
         (ticket_id, tipo, asunto, descripcion_md, payload, asignado_a,
          grupo_asignado, creado_por, bloqueante, vence_at,
          visible_cliente, titulo_cliente)
       VALUES ($1, $2::tipo_tarea_caso, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        ticketId,
        tipo,
        asunto,
        descripcion ?? null,
        JSON.stringify(payload ?? {}),
        asignadoA ?? null,
        grupo,
        viewer.userId,
        bloqueante ?? false,
        venceEn ?? null,
        visible,
        tituloClienteFinal,
      ],
    );
    if (!row) return { ok: false, message: 'No pudimos crear la tarea' };

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.tarea.creada',
      entidad: 'tareas_caso',
      entidadId: row.id,
      valorNuevo: {
        tipo,
        asunto,
        grupo_asignado: grupo,
        asignado_a: asignadoA ?? null,
        bloqueante: bloqueante ?? false,
        visible_cliente: visible,
        titulo_cliente: tituloClienteFinal,
      },
      ticketId,
    });

    revalidatePath(`/dashboard/soporte/ticket/${ticketId}`);
    return { ok: true, tareaId: row.id };
  });
}

const CompletarInput = z.object({
  tareaId: z.string().uuid(),
  resultado: z.string().trim().min(5, 'Describe brevemente cómo se completó').max(2000),
});

export async function completarTarea(
  input: z.infer<typeof CompletarInput>,
): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.tarea.completar');
  const parsed = CompletarInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { tareaId, resultado } = parsed.data;

  return await withTransaction(async (tx) => {
    const tarea = await tx.queryOne<{
      ticket_id: string;
      estado: string;
      asignado_a: string | null;
      grupo_asignado: string;
    }>(
      `SELECT ticket_id, estado::text AS estado, asignado_a, grupo_asignado
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
    if (!isOwner && !isSuperAdmin) {
      return {
        ok: false,
        message: 'Solo el agente asignado o un super_admin puede completar esta tarea',
      };
    }

    await tx.query(
      `UPDATE tareas_caso
          SET estado = 'completada',
              completada_at = NOW(),
              completada_por = $1,
              resultado_md = $2,
              updated_at = NOW()
        WHERE id = $3`,
      [viewer.userId, resultado, tareaId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.tarea.completada',
      entidad: 'tareas_caso',
      entidadId: tareaId,
      valorAnterior: { estado: tarea.estado },
      valorNuevo: { estado: 'completada', resultado },
      ticketId: tarea.ticket_id,
    });

    revalidatePath(`/dashboard/soporte/ticket/${tarea.ticket_id}`);
    return { ok: true };
  });
}

const CancelarInput = z.object({
  tareaId: z.string().uuid(),
  motivo: z.string().trim().min(5).max(2000),
});

export async function cancelarTarea(
  input: z.infer<typeof CancelarInput>,
): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.tarea.crear');
  const parsed = CancelarInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { tareaId, motivo } = parsed.data;

  return await withTransaction(async (tx) => {
    const tarea = await tx.queryOne<{
      ticket_id: string;
      estado: string;
      creado_por: string;
    }>(
      `SELECT ticket_id, estado::text AS estado, creado_por
         FROM tareas_caso
        WHERE id = $1
        FOR UPDATE`,
      [tareaId],
    );
    if (!tarea) return { ok: false, message: 'Tarea no encontrada' };
    if (tarea.estado === 'completada' || tarea.estado === 'cancelada') {
      return { ok: false, message: 'La tarea ya fue cerrada' };
    }

    const isCreator = tarea.creado_por === viewer.userId;
    const isSuperAdmin = tienePermiso(viewer, 'roles.gestionar');
    if (!isCreator && !isSuperAdmin) {
      return {
        ok: false,
        message: 'Solo quien creó la tarea o un super_admin puede cancelarla',
      };
    }

    await tx.query(
      `UPDATE tareas_caso
          SET estado = 'cancelada',
              completada_at = NOW(),
              completada_por = $1,
              resultado_md = $2,
              updated_at = NOW()
        WHERE id = $3`,
      [viewer.userId, motivo, tareaId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.tarea.cancelada',
      entidad: 'tareas_caso',
      entidadId: tareaId,
      valorAnterior: { estado: tarea.estado },
      valorNuevo: { estado: 'cancelada', motivo },
      ticketId: tarea.ticket_id,
    });

    revalidatePath(`/dashboard/soporte/ticket/${tarea.ticket_id}`);
    return { ok: true };
  });
}

const VisibilidadInput = z
  .object({
    tareaId: z.string().uuid(),
    visible: z.boolean(),
    tituloCliente: z.string().trim().min(3).max(160).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.visible) {
      const titulo = value.tituloCliente?.trim();
      if (!titulo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tituloCliente'],
          message: 'Título visible al cliente es obligatorio cuando la tarea es visible',
        });
      }
    }
  });

export async function setTareaVisibilidadCliente(
  input: z.infer<typeof VisibilidadInput>,
): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.tarea.crear');
  const parsed = VisibilidadInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { tareaId, visible, tituloCliente } = parsed.data;

  return await withTransaction(async (tx) => {
    const tarea = await tx.queryOne<{
      ticket_id: string;
      estado: string;
      visible_cliente: boolean;
      titulo_cliente: string | null;
    }>(
      `SELECT ticket_id, estado::text AS estado, visible_cliente, titulo_cliente
         FROM tareas_caso
        WHERE id = $1
        FOR UPDATE`,
      [tareaId],
    );
    if (!tarea) return { ok: false, message: 'Tarea no encontrada' };

    const tituloClienteFinal = visible ? (tituloCliente ?? '').trim() : null;

    await tx.query(
      `UPDATE tareas_caso
          SET visible_cliente = $1,
              titulo_cliente = $2,
              updated_at = NOW()
        WHERE id = $3`,
      [visible, tituloClienteFinal, tareaId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.tarea.visibilidad_cambiada',
      entidad: 'tareas_caso',
      entidadId: tareaId,
      valorAnterior: {
        visible_cliente: tarea.visible_cliente,
        titulo_cliente: tarea.titulo_cliente,
      },
      valorNuevo: {
        visible_cliente: visible,
        titulo_cliente: tituloClienteFinal,
      },
      ticketId: tarea.ticket_id,
    });

    revalidatePath(`/dashboard/soporte/ticket/${tarea.ticket_id}`);
    return { ok: true, tareaId };
  });
}

const TransferirInput = z.object({
  tareaId: z.string().uuid(),
  nuevoAsignado: z.string().uuid().optional().nullable(),
  nuevoGrupo: z.string().trim().min(2).max(60).optional(),
  motivo: z.string().trim().min(5).max(500),
});

export async function transferirTarea(
  input: z.infer<typeof TransferirInput>,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = TransferirInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { tareaId, nuevoAsignado, nuevoGrupo, motivo } = parsed.data;

  if (!nuevoAsignado && !nuevoGrupo) {
    return { ok: false, message: 'Especifica un nuevo asignado o un nuevo grupo' };
  }

  return await withTransaction(async (tx) => {
    const tarea = await tx.queryOne<{
      ticket_id: string;
      estado: string;
      asignado_a: string | null;
      grupo_asignado: string;
    }>(
      `SELECT ticket_id, estado::text AS estado, asignado_a, grupo_asignado
         FROM tareas_caso
        WHERE id = $1
        FOR UPDATE`,
      [tareaId],
    );
    if (!tarea) return { ok: false, message: 'Tarea no encontrada' };
    if (tarea.estado === 'completada' || tarea.estado === 'cancelada') {
      return { ok: false, message: 'La tarea ya fue cerrada' };
    }

    if (nuevoAsignado) {
      const u = await tx.queryOne<{ rol: string }>(
        `SELECT rol::text AS rol FROM usuarios WHERE id = $1`,
        [nuevoAsignado],
      );
      if (!u) return { ok: false, message: 'Usuario destino no existe' };
      if (u.rol === 'cliente' || u.rol === 'prestador') {
        return { ok: false, message: 'Solo personal interno puede recibir tareas' };
      }
    }

    await tx.query(
      `UPDATE tareas_caso
          SET asignado_a = COALESCE($1, asignado_a),
              grupo_asignado = COALESCE($2, grupo_asignado),
              estado = 'abierta',
              updated_at = NOW()
        WHERE id = $3`,
      [nuevoAsignado ?? null, nuevoGrupo ?? null, tareaId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.tarea.transferida',
      entidad: 'tareas_caso',
      entidadId: tareaId,
      valorAnterior: {
        asignado_a: tarea.asignado_a,
        grupo_asignado: tarea.grupo_asignado,
      },
      valorNuevo: {
        asignado_a: nuevoAsignado ?? tarea.asignado_a,
        grupo_asignado: nuevoGrupo ?? tarea.grupo_asignado,
        motivo,
      },
      ticketId: tarea.ticket_id,
    });

    revalidatePath(`/dashboard/soporte/ticket/${tarea.ticket_id}`);
    return { ok: true };
  });
}
