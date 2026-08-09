import type { SlaLevel } from '@/lib/dashboard/sla-shared';

interface Props {
  dueAt: string | null;
  breached: boolean;
  resueltoAt?: string | null;
  compact?: boolean;
}

const TONE: Record<SlaLevel, string> = {
  verde: 'border-success/40 bg-success/5 text-success',
  amarillo: 'border-warning/40 bg-warning/5 text-warning',
  rojo: 'border-destructive/40 bg-destructive/5 text-destructive',
  breached: 'border-destructive bg-destructive text-destructive-foreground',
};

const LABEL: Record<SlaLevel, string> = {
  verde: 'En tiempo',
  amarillo: 'Advertencia',
  rojo: 'Por vencer',
  breached: 'SLA vencido',
};

function levelFor(dueAt: string, breached: boolean): SlaLevel {
  if (breached) return 'breached';
  const remaining = new Date(dueAt).getTime() - Date.now();
  if (remaining <= 0) return 'breached';
  const oneHour = 3600 * 1000;
  if (remaining < oneHour) return 'rojo';
  if (remaining < 4 * oneHour) return 'amarillo';
  return 'verde';
}

function formatRelative(dueAt: string): string {
  const diffMs = new Date(dueAt).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const minutes = Math.floor(abs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  let frag: string;
  if (days >= 1) {
    const remHours = hours % 24;
    frag = remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
  } else if (hours >= 1) {
    const remMin = minutes % 60;
    frag = remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`;
  } else {
    frag = `${minutes}m`;
  }
  return diffMs >= 0 ? `en ${frag}` : `vencido hace ${frag}`;
}

export function SlaBadge({ dueAt, breached, resueltoAt, compact }: Props) {
  if (!dueAt) return null;
  if (resueltoAt) {
    const tone = breached
      ? 'border-destructive/40 bg-destructive/5 text-destructive'
      : 'border-success/40 bg-success/5 text-success';
    const label = breached ? 'Cerrado fuera de SLA' : 'Cerrado en SLA';
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${tone}`}
      >
        {label}
      </span>
    );
  }
  const level = levelFor(dueAt, breached);
  const formatted = formatRelative(dueAt);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${TONE[level]}`}
    >
      {LABEL[level]}
      {!compact ? <span className="text-[10px] opacity-80"> · {formatted}</span> : null}
    </span>
  );
}
