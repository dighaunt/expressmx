'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@expressmx/validations';
import { withTransaction } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requireViewer } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import type { TierSoporte } from '@/lib/dashboard/tickets-shared';

interface ActionResult {
  ok: boolean;
  message?: string;
}

const Input = z.object({
  ticketId: z.string().uuid(),
  toTier: z.enum(['l2', 'l3']),
  motivo: z.enum([
    'fuera_alcance',
    'requiere_autorizacion',
    'requiere_dev',
    'sla_breach',
    'cliente_solicitud',
  ]),
  hipotesis: z
    .string()
    .trim()
    .min(20, 'La hipótesis debe tener al menos 20 caracteres')
    .max(500),
  kbConsultados: z.array(z.string().uuid()).optional(),
});

const TIER_RANK: Record<TierSoporte, number> = { l1: 1, l2: 2, l3: 3 };

const GRUPO_DESTINO: Record<'l2' | 'l3', string> = {
  l2: 'soporte_l2',
  l3: 'dev_l3',
};

export async function escalarTicket(
  input: z.infer<typeof Input>,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = Input.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.errors[0]?.message ?? 'Input inválido',
    };
  }
  const { ticketId, toTier, motivo, hipotesis, kbConsultados } = parsed.data;

  if (toTier === 'l2' && !tienePermiso(viewer, 'soporte.tickets.escalar_l2')) {
    return { ok: false, message: 'Sin permiso para escalar a L2' };
  }
  if (toTier === 'l3' && !tienePermiso(viewer, 'soporte.tickets.escalar_l3')) {
    return { ok: false, message: 'Sin permiso para escalar a L3' };
  }

  return await withTransaction(async (tx) => {
    const ticket = await tx.queryOne<{
      tier_actual: TierSoporte;
      grupo_asignado: string;
    }>(
      `SELECT tier_actual::text AS tier_actual, grupo_asignado
         FROM tickets_soporte
        WHERE id = $1
        FOR UPDATE`,
      [ticketId],
    );
    if (!ticket) return { ok: false, message: 'Ticket no encontrado' };

    const fromTier: TierSoporte = ticket.tier_actual;
    const fromRank = TIER_RANK[fromTier] ?? 1;
    const toRank = TIER_RANK[toTier];
    if (toRank <= fromRank) {
      return {
        ok: false,
        message: `El ticket ya está en ${fromTier.toUpperCase()}; no se puede escalar a ${toTier.toUpperCase()}`,
      };
    }

    const toGrupo = GRUPO_DESTINO[toTier];

    await tx.query(
      `INSERT INTO escalation_log_ticket
         (ticket_id, from_tier, to_tier, motivo, hipotesis, kb_consultados, from_user, to_grupo, ocurrido_at)
       VALUES ($1, $2::tier_soporte, $3::tier_soporte, $4::escalation_motivo, $5, $6::uuid[], $7, $8, NOW())`,
      [
        ticketId,
        fromTier,
        toTier,
        motivo,
        hipotesis,
        kbConsultados ?? [],
        viewer.userId,
        toGrupo,
      ],
    );

    await tx.query(
      `UPDATE tickets_soporte
          SET tier_actual = $1::tier_soporte,
              grupo_asignado = $2,
              estatus = 'escalado',
              updated_at = NOW()
        WHERE id = $3`,
      [toTier, toGrupo, ticketId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.escalar_ticket',
      entidad: 'tickets_soporte',
      entidadId: ticketId,
      valorAnterior: {
        tier_actual: fromTier,
        grupo_asignado: ticket.grupo_asignado,
      },
      valorNuevo: {
        tier_actual: toTier,
        grupo_asignado: toGrupo,
        motivo,
      },
      ticketId,
    });

    revalidatePath(`/dashboard/soporte/ticket/${ticketId}`);
    revalidatePath('/dashboard/soporte');
    return { ok: true };
  });
}
