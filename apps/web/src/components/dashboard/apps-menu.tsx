'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import * as Popover from '@radix-ui/react-popover';
import { SquaresFour, X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export type AppMenuItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  iconSm: ReactNode;
  iconLg: ReactNode;
  iconClassName: string;
};

interface Props {
  workspace: ReadonlyArray<AppMenuItem>;
}

export function AppsMenu({ workspace }: Props) {
  if (workspace.length === 0) return null;

  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors',
          'hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
          'aria-expanded:bg-muted',
        )}
        aria-label="Abrir menú de aplicaciones"
      >
        <SquaresFour size={18} aria-hidden />
        <span className="hidden sm:inline">Apps</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={12}
          collisionPadding={16}
          className={cn(
            'z-50 flex w-[calc(100vw-1rem)] max-w-md flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none',
            'sm:w-[min(94vw,32rem)] sm:max-w-none md:w-[min(90vw,36rem)] lg:w-[min(88vw,40rem)]',
            'max-h-[var(--radix-popover-content-available-height)]',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-2">
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Workspaces
            </p>
            <Popover.Close
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden"
              aria-label="Cerrar"
            >
              <X size={16} aria-hidden />
            </Popover.Close>
          </div>

          <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {workspace.map((app) => (
              <Item key={app.id} app={app} />
            ))}
          </ul>

          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Item({ app, small }: { app: AppMenuItem; small?: boolean }) {
  return (
    <li>
      <Popover.Close asChild>
        <Link
          href={app.href}
          className={cn(
            'flex h-full flex-col gap-1 rounded-lg p-3 text-left transition-colors',
            'hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
            small && 'p-2',
          )}
        >
          <span
            className={cn(
              'inline-flex size-8 items-center justify-center rounded-md',
              app.iconClassName,
              small && 'size-7',
            )}
          >
            <span className="contents max-sm:hidden">{app.iconSm}</span>
            <span className="hidden max-sm:contents">{app.iconLg}</span>
          </span>
          <span
            className={cn(
              'mt-1 text-sm font-medium leading-tight text-foreground',
              small && 'text-xs',
            )}
          >
            {app.label}
          </span>
          {!small ? (
            <span className="text-xs leading-tight text-muted-foreground">
              {app.description}
            </span>
          ) : null}
        </Link>
      </Popover.Close>
    </li>
  );
}
