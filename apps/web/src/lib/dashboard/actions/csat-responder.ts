'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@expressmx/validations';
import { withTransaction } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requireViewer } from '@/lib/dashboard/auth-gate';

interface ActionResult {
  ok: boolean;
  message?: string;
}

const Input = z.object({
  surveyId: z.string().uuid(),
  csatScore: z.number().int().min(1).max(5),
  cesScore: z.number().int().min(1).max(7).optional(),
  comentario: z.string().trim().max(1000).optional(),
});

export async function responderCsat(
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
  const { surveyId, csatScore, cesScore, comentario } = parsed.data;

  const result = await withTransaction(async (tx) => {
    const survey = await tx.queryOne<{
      cliente_id: string;
      estado: string;
      expira_at: string;
      ticket_id: string;
    }>(
      `SELECT cliente_id, estado::text AS estado, expira_at, ticket_id
         FROM csat_surveys
        WHERE id = $1
        FOR UPDATE`,
      [surveyId],
    );
    if (!survey) {
      return { ok: false as const, message: 'Survey no encontrada' };
    }
    if (survey.cliente_id !== viewer.userId) {
      return { ok: false as const, message: 'Esta survey no es tuya' };
    }
    if (survey.estado === 'respondido') {
      return { ok: false as const, message: 'Ya respondiste esta survey' };
    }
    if (new Date(survey.expira_at).getTime() < Date.now()) {
      return { ok: false as const, message: 'Esta survey ha expirado' };
    }

    await tx.query(
      `UPDATE csat_surveys
          SET csat_score = $1,
              ces_score = $2,
              comentario = $3,
              estado = 'respondido'::estado_csat,
              respondido_at = NOW()
        WHERE id = $4`,
      [csatScore, cesScore ?? null, comentario ?? null, surveyId],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.responder_csat',
      entidad: 'csat_surveys',
      entidadId: surveyId,
      valorNuevo: { csat_score: csatScore, ces_score: cesScore ?? null },
      ticketId: survey.ticket_id,
    });

    return { ok: true as const };
  });

  if (result.ok) {
    revalidatePath('/dashboard/mi/csat');
    revalidatePath('/mi/csat');
  }
  return result;
}
