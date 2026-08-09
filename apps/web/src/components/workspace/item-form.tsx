import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';

interface Props {
  title: string;
  subtitle?: string;
  badges?: ReactNode;
  meta?: ReactNode;
  fields?: ReactNode;
  activity?: ReactNode;
}

export function ItemForm({ title, subtitle, badges, meta, fields, activity }: Props) {
  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {badges ? <div className="flex flex-wrap gap-2">{badges}</div> : null}
        </div>
        {meta ? <div className="text-xs text-muted-foreground">{meta}</div> : null}
      </header>

      {fields ? <Card className="rounded-xl p-5">{fields}</Card> : null}

      {activity ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Actividad
          </h2>
          {activity}
        </section>
      ) : null}
    </article>
  );
}

interface ActivityEntryProps {
  time: string;
  author: string;
  authorTone?: 'agent' | 'cliente' | 'sistema' | 'audit';
  content: ReactNode;
  small?: ReactNode;
  esInterno?: boolean | undefined;
}

const TONE_BG: Record<NonNullable<ActivityEntryProps['authorTone']>, string> = {
  agent: 'bg-primary/10 text-primary',
  cliente: 'bg-secondary text-secondary-foreground',
  sistema: 'bg-muted text-muted-foreground',
  audit: 'bg-warning/15 text-warning-foreground',
};

export function ActivityEntry({
  time,
  author,
  authorTone = 'agent',
  content,
  small,
  esInterno,
}: ActivityEntryProps) {
  const containerClass = esInterno
    ? 'flex gap-3 rounded-lg border border-warning/40 bg-warning/5 p-3'
    : 'flex gap-3 rounded-lg border border-border bg-card p-3';
  const avatarClass = esInterno
    ? 'mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-warning/20 text-warning text-[11px] font-semibold'
    : `mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${TONE_BG[authorTone]}`;
  return (
    <div className={containerClass}>
      <span className={avatarClass}>{author.slice(0, 2).toUpperCase()}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
          <span className="font-semibold text-foreground">{author}</span>
          <span className="text-muted-foreground">{time}</span>
          {esInterno ? (
            <span className="rounded-md border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
              Nota interna · solo agentes
            </span>
          ) : null}
          {small ? <span className="text-muted-foreground">· {small}</span> : null}
        </div>
        <div className="mt-1 text-sm leading-relaxed">{content}</div>
      </div>
    </div>
  );
}
