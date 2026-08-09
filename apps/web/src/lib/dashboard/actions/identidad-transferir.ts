'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@expressmx/validations';
import { withTransaction } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

interface TransferirVerificacionResult {
  ok: boolean;
  message?: string;
  verificacionId?: string;
  expiraAt?: string;
}

const Input = z.object({
  ticketId: z.string().uuid(),
  motivo: z.string().trim().min(10, 'Motivo mínimo 10 caracteres').max(2000),
});

export async function transferirVerificacion(
  input: z.infer<typeof Input>,
): Promise<TransferirVerificacionResult> {
  const viewer = await requirePermiso('soporte.tarea.crear');
  const parsed = Input.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? 'Input inválido' };
  }
  const { ticketId, motivo } = parsed.data;

  return await withTransaction(async (tx) => {
    const origen = await tx.queryOne<{
      id: string;
      cliente_id: string;
      expira_at: string;
    }>(
      `SELECT id, cliente_id, expira_at
         FROM verificaciones_identidad_cliente
        WHERE ticket_id = $1
          AND expira_at > NOW()
        ORDER BY verificado_at DESC
        LIMIT 1`,
      [ticketId],
    );

    if (!origen) {
      return {
        ok: false,
        message:
          'No hay una verificación de identidad activa en este ticket. Pide al cliente un PIN nuevo.',
      };
    }

    const nueva = await tx.queryOne<{ id: string; expira_at: string }>(
      `INSERT INTO verificaciones_identidad_cliente
         (cliente_id, ticket_id, metodo, verificado_por, expira_at, notas)
       VALUES ($1, $2, 'transferida', $3, $4, $5)
       RETURNING id, expira_at`,
      [origen.cliente_id, ticketId, viewer.userId, origen.expira_at, motivo],
    );

    if (!nueva) return { ok: false, message: 'No pudimos transferir la verificación' };

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.identidad.transferida',
      entidad: 'verificaciones_identidad_cliente',
      entidadId: nueva.id,
      valorNuevo: {
        ticket_id: ticketId,
        motivo,
        verif_origen_id: origen.id,
      },
      ticketId,
    });

    revalidatePath(`/dashboard/soporte/ticket/${ticketId}`);
    return { ok: true, verificacionId: nueva.id, expiraAt: nueva.expira_at };
  });
}
