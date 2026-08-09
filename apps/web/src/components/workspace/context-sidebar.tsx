import type { ReactNode } from 'react';
import type { Icon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface Section {
  key: string;
  title: string;
  children: ReactNode;
}

interface Props {
  sections: ReadonlyArray<Section>;
}

export function ContextSidebar({ sections }: Props) {
  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <Card key={s.key} className="rounded-lg p-3">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {s.title}
          </h3>
          {s.children}
        </Card>
      ))}
    </div>
  );
}

export interface ActionItem {
  key: string;
  label: string;
  icon?: Icon;
  tone?: 'default' | 'success' | 'warning' | 'destructive';
  disabled?: boolean;
  hidden?: boolean;
  hint?: string;
  onClick?: () => void;
  href?: string;
}

interface ActionPanelProps {
  actions: ReadonlyArray<ActionItem>;
}

const TONE_CLASSES: Record<NonNullable<ActionItem['tone']>, string> = {
  default: 'border-border hover:bg-muted text-foreground',
  success: 'border-success/40 bg-success/5 text-success hover:bg-success/10',
  warning: 'border-warning/40 bg-warning/5 text-warning-foreground hover:bg-warning/10',
  destructive:
    'border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10',
};

export function ActionPanel({ actions }: ActionPanelProps) {
  const visibles = actions.filter((a) => !a.hidden);
  if (visibles.length === 0) {
    return (
      <p className="px-2 py-3 text-xs text-muted-foreground">
        No tienes acciones disponibles para este item con tu rol actual.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {visibles.map((a) => {
        const IconCmp = a.icon;
        const className = cn(
          'flex w-full items-center gap-2 rounded-md border bg-background px-3 py-2 text-left text-sm font-medium transition-colors disabled:opacity-60',
          TONE_CLASSES[a.tone ?? 'default'],
        );
        const inner = (
          <>
            {IconCmp ? <IconCmp size={14} aria-hidden /> : null}
            <span className="flex-1">{a.label}</span>
            {a.hint ? (
              <span className="text-[11px] font-normal text-muted-foreground">
                {a.hint}
              </span>
            ) : null}
          </>
        );
        if (a.href && !a.disabled) {
          return (
            <li key={a.key}>
              <a href={a.href} className={className}>
                {inner}
              </a>
            </li>
          );
        }
        return (
          <li key={a.key}>
            <button
              type="button"
              onClick={a.onClick}
              disabled={a.disabled}
              className={className}
            >
              {inner}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
