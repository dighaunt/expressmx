import 'server-only';
import { query, queryOne } from '@expressmx/database';
import type { SlaPolicySummary, SlaState } from '@/lib/dashboard/sla-shared';

export async function getTicketSlaState(ticketId: string): Promise<SlaState | null> {
  return queryOne<SlaState>(
    `SELECT
       ticket_id,
       policy_id,
       frt_due_at,
       ttr_due_at,
       primer_respuesta_at,
       resuelto_at,
       paused_since,
       paused_total_secs,
       notified_50,
       notified_80,
       notified_100,
       breached_frt,
       breached_ttr
     FROM ticket_sla_state
     WHERE ticket_id = $1`,
    [ticketId],
  );
}

export async function listSlaPolicies(): Promise<SlaPolicySummary[]> {
  return query<SlaPolicySummary>(
    `SELECT
       id,
       nombre,
       tipo::text AS tipo,
       prioridad::text AS prioridad,
       categoria::text AS categoria,
       frt_minutos,
       ttr_minutos,
       business_hours_only
     FROM sla_policies
     WHERE activo = TRUE
     ORDER BY prioridad, tipo, nombre`,
  );
}

export interface SlaQueueState {
  ttr_due_at: string;
  breached_ttr: boolean;
  resuelto_at: string | null;
}

export async function getSlaStatesByTicketIds(
  ticketIds: ReadonlyArray<string>,
): Promise<Map<string, SlaQueueState>> {
  if (ticketIds.length === 0) return new Map();
  const rows = await query<{
    ticket_id: string;
    ttr_due_at: string;
    breached_ttr: boolean;
    resuelto_at: string | null;
  }>(
    `SELECT ticket_id, ttr_due_at, breached_ttr, resuelto_at
       FROM ticket_sla_state
      WHERE ticket_id = ANY($1::uuid[])`,
    [ticketIds],
  );
  const map = new Map<string, SlaQueueState>();
  for (const r of rows) {
    map.set(r.ticket_id, {
      ttr_due_at: r.ttr_due_at,
      breached_ttr: r.breached_ttr,
      resuelto_at: r.resuelto_at,
    });
  }
  return map;
}
