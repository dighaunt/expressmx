import Link from 'next/link';
import type { Icon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export interface QueueTab {
  key: string;
  label: string;
  count?: number;
  icon?: Icon;
  href: string;
}

interface Props {
  title: string;
  tabs: ReadonlyArray<QueueTab>;
  activeKey: string;
  empty?: string;
  children?: React.ReactNode;
}

export function WorkQueue({ title, tabs, activeKey, children, empty }: Props) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <nav className="space-y-1">
        {tabs.map((t) => {
          const active = t.key === activeKey;
          const IconCmp = t.icon;
          return (
            <Link
              key={t.key}
              href={t.href}
              className={cn(
                'flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                active
                  ? 'bg-primary/10 font-semibold text-primary'
                  : 'text-foreground hover:bg-muted',
              )}
            >
              <span className="flex items-center gap-2 truncate">
                {IconCmp ? <IconCmp size={14} aria-hidden /> : null}
                <span className="truncate">{t.label}</span>
              </span>
              {typeof t.count === 'number' ? (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums',
                    active
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {t.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1">
        {children ?? <p className="px-2 py-3 text-xs text-muted-foreground">{empty}</p>}
      </div>
    </div>
  );
}

interface QueueItemProps {
  href: string;
  active?: boolean;
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: React.ReactNode;
}

export function QueueItem({ href, active, title, subtitle, meta, badge }: QueueItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col gap-0.5 rounded-md border px-2.5 py-2 text-sm transition-colors',
        active
          ? 'border-primary/40 bg-primary/5'
          : 'border-transparent bg-card hover:border-border hover:bg-muted/40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate font-medium">{title}</span>
        {badge}
      </div>
      {subtitle ? (
        <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
      ) : null}
      {meta ? <span className="text-[11px] text-muted-foreground">{meta}</span> : null}
    </Link>
  );
}
