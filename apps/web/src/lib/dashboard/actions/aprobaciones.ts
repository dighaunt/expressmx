'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@expressmx/validations';
import { withTransaction, type Tx } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requireViewer } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';

interface ActionResult {
  ok: boolean;
  message?: string;
  aprobacionId?: string;
}

const ENTIDAD = [
  'reembolsos',
  'tareas_caso',
  'saldo_cliente_movimientos',
  'suspensiones_cuenta',
] as const;

const SolicitarInput = z.object({
  entidad: z.enum(ENTIDAD),
  entidadId: z.string().uuid(),
  motivo: z.string().trim().min(10, 'Motivo mínimo 10 caracteres').max(2000),
  montoMxn: z.number().positive().optional().nullable(),
  aprobadorGrupo: z.enum(['finanzas', 'super_admin']),
  ttlHoras: z.number().int().positive().max(720).optional(),
});

async function getDefaultTtlHoras(tx: Tx): Promise<number> {
  const row = await tx.queryOne<{ valor: string }>(
    `SELECT valor FROM config_sistema WHERE clave = 'aprobacion_default_ttl_horas'`,
  );
  const parsed = row ? Number(row.valor) : 72;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 72;
}

async function entidadExiste(tx: Tx, entidad: string, id: string): Promise<boolean> {
  const tabla =
    entidad === 'reembolsos'
      ? 'reembolsos'
      : entidad === 'tareas_caso'
        ? 'tareas_caso'
        : entidad === 'saldo_cliente_movimientos'
          ? 'saldo_cliente_movimientos'
          : 'suspensiones_cuenta';
  const row = await tx.queryOne<{ id: string }>(
    `SELECT id FROM ${tabla} WHERE id = $1`,
    [id],
  );
  return !!row;
}

export async function solicitarAprobacion(
  input: z.infer<typeof SolicitarInput>,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = SolicitarInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { entidad, entidadId, motivo, montoMxn, aprobadorGrupo, ttlHoras } = parsed.data;

  return await withTransaction(async (tx) => {
    const exists = await entidadExiste(tx, entidad, entidadId);
    if (!exists) {
      return { ok: false, message: `${entidad} ${entidadId} no existe` };
    }

    const yaPendiente = await tx.queryOne<{ id: string }>(
      `SELECT id FROM aprobaciones
        WHERE entidad = $1 AND entidad_id = $2 AND estado = 'solicitada'
        LIMIT 1`,
      [entidad, entidadId],
    );
    if (yaPendiente) {
      return { ok: false, message: 'Ya hay una solicitud pendiente para esta entidad' };
    }

    const ttl = ttlHoras ?? (await getDefaultTtlHoras(tx));

    const row = await tx.queryOne<{ id: string }>(
      `INSERT INTO aprobaciones
         (entidad, entidad_id, motivo_md, monto_mxn, solicitado_por,
          aprobador_grupo, expira_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW() + ($7 || ' hours')::interval)
       RETURNING id`,
      [
        entidad,
        entidadId,
        motivo,
        montoMxn ?? null,
        viewer.userId,
        aprobadorGrupo,
        String(ttl),
      ],
    );
    if (!row) return { ok: false, message: 'No pudimos crear la aprobación' };

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.aprobacion.solicitada',
      entidad: 'aprobaciones',
      entidadId: row.id,
      valorNuevo: {
        target_entidad: entidad,
        target_id: entidadId,
        monto_mxn: montoMxn ?? null,
        aprobador_grupo: aprobadorGrupo,
      },
    });

    revalidatePath('/dashboard/finanzas/aprobaciones-pendientes');
    return { ok: true, aprobacionId: row.id };
  });
}

const DecidirInput = z.object({
  aprobacionId: z.string().uuid(),
  notas: z.string().trim().min(5, 'Notas mínimo 5 caracteres').max(2000),
});

async function decidirComun(
  input: z.infer<typeof DecidirInput>,
  decision: 'aprobada' | 'rechazada',
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = DecidirInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { aprobacionId, notas } = parsed.data;

  return await withTransaction(async (tx) => {
    const a = await tx.queryOne<{
      estado: string;
      entidad: string;
      entidad_id: string;
      aprobador_grupo: string;
      solicitado_por: string;
    }>(
      `SELECT estado::text AS estado, entidad, entidad_id,
              aprobador_grupo, solicitado_por
         FROM aprobaciones
        WHERE id = $1
        FOR UPDATE`,
      [aprobacionId],
    );
    if (!a) return { ok: false, message: 'Aprobación no encontrada' };
    if (a.estado !== 'solicitada') {
      return { ok: false, message: `No se puede decidir: estado actual ${a.estado}` };
    }

    if (a.solicitado_por === viewer.userId) {
      return {
        ok: false,
        message: 'Segregación de funciones: no puedes decidir tu propia solicitud',
      };
    }

    const requiredPermiso =
      a.aprobador_grupo === 'super_admin' ? 'roles.gestionar' : 'reembolsos.aprobar';
    if (!tienePermiso(viewer, requiredPermiso)) {
      return {
        ok: false,
        message: `Solo el grupo ${a.aprobador_grupo} puede decidir esta aprobación`,
      };
    }

    await tx.query(
      `UPDATE aprobaciones
          SET estado = $1::estado_aprobacion,
              aprobador_user = $2,
              decidida_at = NOW(),
              notas_decision_md = $3
        WHERE id = $4`,
      [decision, viewer.userId, notas, aprobacionId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion:
        decision === 'aprobada'
          ? 'soporte.aprobacion.aprobada'
          : 'soporte.aprobacion.rechazada',
      entidad: 'aprobaciones',
      entidadId: aprobacionId,
      valorAnterior: { estado: a.estado },
      valorNuevo: { estado: decision, notas, target_entidad: a.entidad, target_id: a.entidad_id },
    });

    let ticketIdAfectado: string | null = null;

    if (a.entidad === 'reembolsos') {
      const r = await tx.queryOne<{ id: string; estatus: string; ticket_id: string | null }>(
        `SELECT id, estatus::text AS estatus, ticket_id
           FROM reembolsos WHERE id = $1 FOR UPDATE`,
        [a.entidad_id],
      );
      if (r) {
        ticketIdAfectado = r.ticket_id;
        const nuevoEstatus = decision === 'aprobada' ? 'aprobado' : 'rechazado';
        if (r.estatus === 'solicitado') {
          await tx.query(
            `UPDATE reembolsos
                SET estatus = $1::estatus_reembolso,
                    aprobado_por = CASE WHEN $1 = 'aprobado' THEN $2 ELSE aprobado_por END
              WHERE id = $3`,
            [nuevoEstatus, viewer.userId, a.entidad_id],
          );
          await logAccion(tx, {
            adminId: viewer.userId,
            accion:
              decision === 'aprobada'
                ? 'soporte.reembolso.aprobado_via_aprobacion'
                : 'soporte.reembolso.rechazado_via_aprobacion',
            entidad: 'reembolsos',
            entidadId: a.entidad_id,
            valorAnterior: { estatus: r.estatus },
            valorNuevo: { estatus: nuevoEstatus, via_aprobacion_id: aprobacionId },
            ticketId: r.ticket_id,
          });
        }
      }
    } else if (a.entidad === 'tareas_caso') {
      const t = await tx.queryOne<{ id: string; ticket_id: string; estado: string }>(
        `SELECT id, ticket_id, estado::text AS estado
           FROM tareas_caso WHERE id = $1 FOR UPDATE`,
        [a.entidad_id],
      );
      if (t) {
        ticketIdAfectado = t.ticket_id;
        if (decision === 'rechazada') {
          await tx.query(
            `UPDATE tareas_caso
                SET estado = 'cancelada',
                    completada_at = NOW(),
                    completada_por = $1,
                    resultado_md = COALESCE(resultado_md, '') ||
                      E'\nRechazada vía aprobación: ' || $2,
                    updated_at = NOW()
              WHERE id = $3`,
            [viewer.userId, notas, a.entidad_id],
          );
        } else if (t.estado === 'esperando_aprobacion') {
          await tx.query(
            `UPDATE tareas_caso
                SET estado = 'abierta',
                    updated_at = NOW()
              WHERE id = $1`,
            [a.entidad_id],
          );
        }
      }
    }

    if (ticketIdAfectado) {
      const motivoPrefix = `${a.entidad === 'reembolsos' ? 'reembolso' : 'credito'}:${a.entidad_id}`;
      await tx.query(
        `UPDATE tickets_soporte
            SET action_status = 'ninguno'::action_status_ticket,
                action_status_motivo = NULL,
                action_status_desde = NULL,
                updated_at = NOW()
          WHERE id = $1
            AND (
              action_status_motivo = $2
              OR action_status_motivo LIKE 'Reembolso%'
              OR action_status_motivo LIKE 'Crédito%'
            )`,
        [ticketIdAfectado, motivoPrefix],
      );
      revalidatePath(`/dashboard/soporte/ticket/${ticketIdAfectado}`);
    }

    revalidatePath('/dashboard/finanzas/aprobaciones-pendientes');
    revalidatePath('/dashboard/finanzas/tareas-bandeja');
    revalidatePath('/dashboard/reembolsos');
    return { ok: true, aprobacionId };
  });
}

export async function aprobarSolicitud(
  input: z.infer<typeof DecidirInput>,
): Promise<ActionResult> {
  return decidirComun(input, 'aprobada');
}

export async function rechazarSolicitud(
  input: z.infer<typeof DecidirInput>,
): Promise<ActionResult> {
  return decidirComun(input, 'rechazada');
}

const CancelarInput = z.object({
  aprobacionId: z.string().uuid(),
  motivo: z.string().trim().min(5).max(500),
});

export async function cancelarSolicitud(
  input: z.infer<typeof CancelarInput>,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = CancelarInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { aprobacionId, motivo } = parsed.data;

  return await withTransaction(async (tx) => {
    const a = await tx.queryOne<{ estado: string; solicitado_por: string }>(
      `SELECT estado::text AS estado, solicitado_por
         FROM aprobaciones
        WHERE id = $1
        FOR UPDATE`,
      [aprobacionId],
    );
    if (!a) return { ok: false, message: 'Aprobación no encontrada' };
    if (a.estado !== 'solicitada') {
      return { ok: false, message: `No se puede cancelar: estado actual ${a.estado}` };
    }
    if (a.solicitado_por !== viewer.userId && !tienePermiso(viewer, 'roles.gestionar')) {
      return {
        ok: false,
        message: 'Solo quien la solicitó o un super_admin puede cancelarla',
      };
    }

    await tx.query(
      `UPDATE aprobaciones
          SET estado = 'cancelada',
              decidida_at = NOW(),
              notas_decision_md = $1
        WHERE id = $2`,
      [motivo, aprobacionId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.aprobacion.cancelada',
      entidad: 'aprobaciones',
      entidadId: aprobacionId,
      valorAnterior: { estado: a.estado },
      valorNuevo: { estado: 'cancelada', motivo },
    });

    revalidatePath('/dashboard/finanzas/aprobaciones-pendientes');
    return { ok: true, aprobacionId };
  });
}
