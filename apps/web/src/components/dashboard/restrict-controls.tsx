'use client';

import { useState, useTransition } from 'react';
import { ShieldCheck, ShieldWarning } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ActionResult = { ok: boolean; message?: string };

interface Props {
  targetId: string;
  tone: 'restrict' | 'unrestrict';
  restringir: (id: string, motivo: string) => Promise<ActionResult>;
  quitar: (id: string) => Promise<ActionResult>;
}

export function RestrictControls({ targetId, tone, restringir, quitar }: Props) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [pending, startTransition] = useTransition();

  function submitRestrict() {
    if (motivo.trim().length < 5) {
      toast.error('El motivo necesita al menos 5 caracteres');
      return;
    }
    startTransition(async () => {
      const r = await restringir(targetId, motivo.trim());
      if (r.ok) {
        toast.success('Cuenta restringida');
        setMotivo('');
        setOpen(false);
      } else {
        toast.error(r.message ?? 'No pudimos aplicar la restricción');
      }
    });
  }

  function submitUnrestrict() {
    startTransition(async () => {
      const r = await quitar(targetId);
      if (r.ok) {
        toast.success('Restricción retirada');
      } else {
        toast.error(r.message ?? 'No pudimos quitar la restricción');
      }
    });
  }

  if (tone === 'unrestrict') {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Quitar restricción</p>
            <p className="text-xs text-muted-foreground">
              La cuenta podrá volver a operar normalmente.
            </p>
          </div>
          <button
            type="button"
            onClick={submitUnrestrict}
            disabled={pending}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-md border border-success/40 bg-success/10 px-3 text-sm font-medium text-success transition-colors',
              'hover:bg-success/20 disabled:opacity-60',
            )}
          >
            <ShieldCheck size={16} aria-hidden />
            {pending ? 'Procesando…' : 'Quitar restricción'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Restringir cuenta</p>
          <p className="text-xs text-muted-foreground">
            La cuenta no podrá operar hasta que un admin retire la restricción.
          </p>
        </div>
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
          >
            <ShieldWarning size={16} aria-hidden />
            Restringir
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-3 space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Motivo</label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            maxLength={280}
            placeholder="Describe brevemente por qué se restringe la cuenta. Lo verá el equipo y queda en el historial."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setMotivo('');
              }}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submitRestrict}
              disabled={pending}
              className="h-9 rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-60"
            >
              {pending ? 'Aplicando…' : 'Aplicar restricción'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
