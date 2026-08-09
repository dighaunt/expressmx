'use server';

import { revalidatePath } from 'next/cache';
import { z } from '@expressmx/validations';
import { withTransaction } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requireViewer } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';

interface ActionResult {
  ok: boolean;
  message?: string;
}

const CODIGOS = [
  'resuelto_directo',
  'kb_resuelto',
  'reembolso_emitido',
  'duplicado',
  'no_aplica',
  'no_reproducible',
  'sin_respuesta_cliente',
] as const;

const CODIGOS_DISPARAN_CSAT = new Set<string>([
  'resuelto_directo',
  'kb_resuelto',
  'reembolso_emitido',
]);

const Input = z.object({
  ticketId: z.string().uuid(),
  codigo: z.enum(CODIGOS),
  notas: z
    .string()
    .trim()
    .min(20, 'Las notas de resolución deben tener al menos 20 caracteres')
    .max(2000),
});

export async function cerrarTicket(
  input: z.infer<typeof Input>,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!tienePermiso(viewer, 'soporte.tickets.cerrar')) {
    return { ok: false, message: 'Sin permiso para cerrar tickets' };
  }

  const parsed = Input.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.errors[0]?.message ?? 'Input inválido',
    };
  }
  const { ticketId, codigo, notas } = parsed.data;

  const result = await withTransaction(async (tx) => {
    const ticket = await tx.queryOne<{
      usuario_id: string;
      agente_id: string | null;
      estatus: string;
    }>(
      `SELECT usuario_id, agente_id, estatus::text AS estatus
         FROM tickets_soporte
        WHERE id = $1
        FOR UPDATE`,
      [ticketId],
    );
    if (!ticket) return { ok: false as const, message: 'Ticket no encontrado' };
    if (ticket.estatus === 'resuelto' || ticket.estatus === 'cerrado') {
      return { ok: false as const, message: 'El ticket ya está cerrado' };
    }

    await tx.query(
      `UPDATE tickets_soporte
          SET estatus = 'resuelto'::estatus_ticket,
              resolucion_codigo = $1::codigo_resolucion,
              resolucion_notas = $2,
              cerrado_at = NOW(),
              cerrado_por = $3,
              updated_at = NOW()
        WHERE id = $4`,
      [codigo, notas, viewer.userId, ticketId],
    );

    const dispararCsat = CODIGOS_DISPARAN_CSAT.has(codigo);
    if (dispararCsat) {
      await tx.query(
        `INSERT INTO csat_surveys
           (ticket_id, cliente_id, agente_id, estado, expira_at)
         VALUES ($1, $2, $3, 'pendiente'::estado_csat, NOW() + INTERVAL '7 days')
         ON CONFLICT (ticket_id) DO NOTHING`,
        [ticketId, ticket.usuario_id, ticket.agente_id],
      );
    }

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'soporte.cerrar_ticket',
      entidad: 'tickets_soporte',
      entidadId: ticketId,
      valorAnterior: { estatus: ticket.estatus },
      valorNuevo: {
        estatus: 'resuelto',
        resolucion_codigo: codigo,
        csat_creado: dispararCsat,
      },
      ticketId,
    });

    return { ok: true as const };
  });

  if (result.ok) {
    revalidatePath(`/dashboard/soporte/ticket/${ticketId}`);
    revalidatePath('/dashboard/soporte');
  }
  return result;
}
