'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, UsersThree, X } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  agregarWatcherPorEmail,
  quitarWatcher,
} from '@/lib/dashboard/actions/tickets-watchers';
import type { TicketWatcher } from '@/lib/dashboard/queries/watchers';

interface Props {
  ticketId: string;
  watchers: TicketWatcher[];
  puedeGestionar: boolean;
}

export function TicketWatchersPanel({ ticketId, watchers, puedeGestionar }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    const value = email.trim();
    if (!value) {
      toast.error('Captura el email interno');
      return;
    }

    startTransition(async () => {
      const r = await agregarWatcherPorEmail({ ticketId, email: value });
      if (r.ok) {
        toast.success(r.message ?? 'Participante agregado');
        setEmail('');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos agregar participante');
      }
    });
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      const r = await quitarWatcher({ ticketId, userId });
      if (r.ok) {
        toast.success('Participante removido');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos remover participante');
      }
    });
  }

  return (
    <div className="space-y-3 text-xs">
      {watchers.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-background p-3 text-muted-foreground">
          <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
            <UsersThree size={14} weight="duotone" aria-hidden />
            Sin participantes internos
          </div>
          Agrega a finanzas, operaciones, legal o líderes que deban seguir el caso.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {watchers.map((w) => (
            <li
              key={w.user_id}
              className="flex items-start justify-between gap-2 rounded-md border border-border bg-background p-2"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{w.user_nombre}</p>
                <p className="truncate text-[11px] text-muted-foreground">{w.user_email}</p>
              </div>
              {puedeGestionar ? (
                <button
                  type="button"
                  onClick={() => handleRemove(w.user_id)}
                  disabled={pending}
                  aria-label={`Quitar a ${w.user_nombre}`}
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
                >
                  <X size={12} aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {puedeGestionar ? (
        <div className="space-y-2 rounded-md border border-border bg-muted/20 p-2">
          <label className="block space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Email interno
            </span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="persona@expressmx.com"
              disabled={pending}
              className="h-9 rounded-md text-xs"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={pending || !email.trim()}
            className="h-8 w-full justify-start text-xs"
          >
            <UserPlus size={13} aria-hidden />
            Agregar participante
          </Button>
        </div>
      ) : null}
    </div>
  );
}
