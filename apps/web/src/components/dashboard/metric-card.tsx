import type { ReactNode } from 'react';
import type { Icon } from '@phosphor-icons/react';

interface Props {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: Icon;
  accent?: 'primary' | 'success' | 'warning' | 'destructive' | 'neutral';
}

const ACCENT_CLASS: Record<NonNullable<Props['accent']>, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning-foreground',
  destructive: 'bg-destructive/15 text-destructive',
  neutral: 'bg-muted text-muted-foreground',
};

export function MetricCard({ label, value, hint, icon: IconCmp, accent = 'neutral' }: Props) {
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {IconCmp ? (
          <span
            className={`inline-flex size-8 items-center justify-center rounded-md ${ACCENT_CLASS[accent]}`}
          >
            <IconCmp size={16} aria-hidden />
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
