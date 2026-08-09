import type { CategoriaTicket, PrioridadTicket, TipoTicket } from './tickets-shared';

export interface SlaPolicySummary {
  id: string;
  nombre: string;
  tipo: TipoTicket;
  prioridad: PrioridadTicket;
  categoria: CategoriaTicket | null;
  frt_minutos: number;
  ttr_minutos: number;
  business_hours_only: boolean;
}

export interface SlaState {
  ticket_id: string;
  policy_id: string;
  frt_due_at: string;
  ttr_due_at: string;
  primer_respuesta_at: string | null;
  resuelto_at: string | null;
  paused_since: string | null;
  paused_total_secs: number;
  notified_50: boolean;
  notified_80: boolean;
  notified_100: boolean;
  breached_frt: boolean;
  breached_ttr: boolean;
}

export type SlaLevel = 'verde' | 'amarillo' | 'rojo' | 'breached';

export function slaLevel(due: Date | null, now: Date = new Date()): SlaLevel {
  if (!due) return 'verde';
  const remaining = due.getTime() - now.getTime();
  if (remaining <= 0) return 'breached';
  const totalDuration = 8 * 60 * 60 * 1000;
  const ratio = remaining / totalDuration;
  if (ratio < 0.2) return 'rojo';
  if (ratio < 0.5) return 'amarillo';
  return 'verde';
}
