'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { CaretDown, ListBullets, Info } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

type ModuleAccent =
  | 'soporte'
  | 'operaciones'
  | 'finanzas'
  | 'rrhh'
  | 'marketing'
  | 'compliance'
  | 'mi'
  | 'clients'
  | 'providers';

interface Props {
  queue: ReactNode;
  main: ReactNode;
  context?: ReactNode;
  header?: ReactNode;
  className?: string;
  accent?: ModuleAccent;
}

export function WorkspaceShell({ queue, main, context, header, className, accent }: Props) {
  const [queueOpen, setQueueOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const accentStyle = accent
    ? ({ '--workspace-accent': `hsl(var(--module-${accent}))` } as CSSProperties)
    : undefined;
  return (
    <div
      className={cn('flex h-full min-h-0 flex-col', className)}
      {...(accentStyle ? { style: accentStyle } : {})}
    >
      {header ? (
        <div
          className={cn(
            'shrink-0 border-b border-border bg-card px-3 py-2.5 sm:px-4',
            accent ? 'border-l-4' : '',
          )}
          {...(accent
            ? { style: { borderLeftColor: 'var(--workspace-accent)' } }
            : {})}
        >
          {header}
        </div>
      ) : null}

      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/30 px-3 py-2 lg:hidden">
        <button
          type="button"
          onClick={() => setQueueOpen((v) => !v)}
          aria-expanded={queueOpen}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          <ListBullets size={14} aria-hidden />
          <span>Cola</span>
          <CaretDown
            size={12}
            aria-hidden
            className={cn('transition-transform', queueOpen ? 'rotate-180' : '')}
          />
        </button>
        {context ? (
          <button
            type="button"
            onClick={() => setContextOpen((v) => !v)}
            aria-expanded={contextOpen}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Info size={14} aria-hidden />
            <span>Detalle</span>
            <CaretDown
              size={12}
              aria-hidden
              className={cn('transition-transform', contextOpen ? 'rotate-180' : '')}
            />
          </button>
        ) : null}
      </div>

      {queueOpen ? (
        <section className="max-h-[60vh] shrink-0 overflow-y-auto border-b border-border bg-muted/30 p-3 lg:hidden">
          {queue}
        </section>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)_300px] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="hidden min-h-0 border-r border-border bg-muted/30 lg:block">
          <div className="h-full overflow-y-auto p-3">{queue}</div>
        </aside>
        <main className="min-h-0 overflow-y-auto bg-background">
          <div className="mx-auto max-w-3xl p-3 sm:p-4 md:p-6">{main}</div>
        </main>
        {context ? (
          <aside className="hidden min-h-0 border-l border-border bg-muted/20 lg:block">
            <div className="h-full overflow-y-auto p-3">{context}</div>
          </aside>
        ) : null}
      </div>

      {contextOpen && context ? (
        <section className="max-h-[60vh] shrink-0 overflow-y-auto border-t border-border bg-muted/20 p-3 lg:hidden">
          {context}
        </section>
      ) : null}
    </div>
  );
}
