import type { ReactNode } from 'react';
import type { Icon } from '@phosphor-icons/react';

interface Props {
  icon?: Icon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: IconCmp, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
      {IconCmp ? (
        <span className="inline-flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <IconCmp size={24} weight="duotone" aria-hidden />
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
