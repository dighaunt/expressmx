'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { CaretDown, SignOut, UserCircle } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  email: string;
  nombre: string;
  avatarUrl: string | null;
}

export function UserMenu({ email, nombre, avatarUrl }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const initials = nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join('');

  function handleLogout() {
    startTransition(async () => {
      try {
        await fetch('/api/v1/auth/logout', { method: 'POST' });
      } catch {
        void 0;
      }
      router.replace('/login');
      router.refresh();
    });
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors',
          'hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
        )}
        aria-label="Menú de usuario"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="size-8 rounded-full ring-1 ring-foreground/10"
          />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-foreground/10">
            {initials || '··'}
          </span>
        )}
        <CaretDown
          size={12}
          aria-hidden
          className={cn('transition-transform', open && 'rotate-180')}
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(
            'z-50 w-56 rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          )}
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">{nombre || 'Sin nombre'}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item asChild>
            <a
              href="/dashboard/cuenta"
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none focus-visible:bg-muted hover:bg-muted"
            >
              <UserCircle size={16} aria-hidden />
              Mi cuenta
            </a>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            disabled={pending}
            onSelect={(e) => {
              e.preventDefault();
              handleLogout();
            }}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive outline-none focus-visible:bg-destructive/10 hover:bg-destructive/10 data-[disabled]:opacity-60"
          >
            <SignOut size={16} aria-hidden />
            {pending ? 'Cerrando…' : 'Cerrar sesión'}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
