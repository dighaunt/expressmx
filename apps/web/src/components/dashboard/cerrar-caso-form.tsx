'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cerrarCaso } from '@/lib/dashboard/actions/soporte';

interface Props {
  casoId: string;
}

export function CerrarCasoForm({ casoId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [pending, startTransition] = useTransition();

  function handleClose() {
    if (motivo.trim().length < 3) {
      toast.error('Describe brevemente cómo cerraste el caso');
      return;
    }
    startTransition(async () => {
      const r = await cerrarCaso(casoId, motivo);
      if (r.ok) {
        toast.success('Caso cerrado');
        setOpen(false);
        setMotivo('');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos cerrar');
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
      >
        <CheckCircle size={14} aria-hidden /> Cerrar caso
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-background p-3">
      <label htmlFor="cerrar-motivo" className="text-sm font-medium">
        ¿Cómo se resolvió?
      </label>
      <textarea
        id="cerrar-motivo"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        rows={3}
        maxLength={280}
        placeholder="Resumen breve para el historial."
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
          onClick={handleClose}
          disabled={pending}
          className="h-9 rounded-md bg-success px-3 text-sm font-medium text-success-foreground hover:bg-success/90 disabled:opacity-60"
        >
          {pending ? 'Cerrando…' : 'Cerrar caso'}
        </button>
      </div>
    </div>
  );
}
