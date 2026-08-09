'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { generarInvitacion } from '@/lib/dashboard/actions/invitaciones';
import { cn } from '@/lib/utils';

export function NuevaInvitacionForm() {
  const router = useRouter();
  const [dias, setDias] = useState(14);
  const [notas, setNotas] = useState('');
  const [pending, startTransition] = useTransition();
  const [generated, setGenerated] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const r = await generarInvitacion(dias, notas || null);
      if (r.ok && r.codigo) {
        setGenerated(r.codigo);
        toast.success('Código generado');
      } else {
        toast.error(r.message ?? 'No pudimos generar el código');
      }
    });
  }

  async function copiar() {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated);
      toast.success('Copiado al portapapeles');
    } catch {
      toast.error('No pudimos copiar');
    }
  }

  if (generated) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-success/40 bg-success/5 p-6 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-success">
            Código listo
          </p>
          <p
            className="mt-2 font-mono text-3xl font-bold tracking-[0.4em] text-foreground"
            data-testid="codigo-generado"
          >
            {generated}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Compártelo con el nuevo prestador. Solo lo puede usar una vez.
          </p>
          <button
            type="button"
            onClick={copiar}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <Copy size={16} aria-hidden />
            Copiar código
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setGenerated(null);
              setNotas('');
            }}
            className="h-10 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted"
          >
            Generar otro
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard/invitaciones')}
            className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Check size={14} aria-hidden className="-mt-0.5 mr-1 inline-block" />
            Volver al listado
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6">
      <div className="space-y-1.5">
        <label htmlFor="dias" className="text-sm font-medium">
          Vigencia (días)
        </label>
        <input
          id="dias"
          type="number"
          min={1}
          max={60}
          value={dias}
          onChange={(e) => setDias(Number(e.target.value) || 14)}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
        <p className="text-xs text-muted-foreground">
          Tras este plazo el código expira automáticamente. Mínimo 1, máximo 60.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="notas" className="text-sm font-medium">
          Notas (opcional)
        </label>
        <textarea
          id="notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          maxLength={280}
          placeholder="Para identificar internamente quién pidió esta invitación o el contexto."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
        <p className="text-right text-xs text-muted-foreground">{notas.length}/280</p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className={cn(
          'h-10 w-full rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors',
          'hover:bg-primary/90 disabled:opacity-60',
        )}
      >
        {pending ? 'Generando…' : 'Generar código'}
      </button>
    </form>
  );
}
