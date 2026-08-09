'use client';

import { useEffect, useState } from 'react';
import { Clock } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface Props {
  expiresAt: string;
  label?: string;
  className?: string;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Expirado';
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (totalMin > 0) return `${totalMin}m`;
  const s = Math.floor(ms / 1000);
  return `${s}s`;
}

export function SLATimer({ expiresAt, label = 'SLA', className }: Props) {
  const [remaining, setRemaining] = useState(() => Date.now() - new Date(expiresAt).getTime());

  useEffect(() => {
    const tick = () => setRemaining(new Date(expiresAt).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const expired = remaining <= 0;
  const warning = !expired && remaining < 30 * 60_000;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        expired && 'border-destructive/40 bg-destructive/10 text-destructive',
        !expired && warning && 'border-warning/40 bg-warning/15 text-warning-foreground',
        !expired && !warning && 'border-success/40 bg-success/10 text-success',
        className,
      )}
    >
      <Clock size={12} aria-hidden />
      <span>{label}</span>
      <span className="tabular-nums">{formatRemaining(remaining)}</span>
    </span>
  );
}
