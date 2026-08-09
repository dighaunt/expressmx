'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Prohibit } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cancelarOrden } from '@/lib/dashboard/actions/ordenes';

interface Props {
  ordenId: string;
  casoId?: string;
  ticketId?: string;
  resumen: string;
}

export function CancelarOrdenForm({ ordenId, casoId, ticketId, resumen }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    if (motivo.trim().length < 5) {
      toast.error('Captura un motivo de al menos 5 caracteres');
      return;
    }
    startTransition(async () => {
      const opts: { casoId?: string; ticketId?: string } = {};
      if (casoId) opts.casoId = casoId;
      if (ticketId) opts.ticketId = ticketId;
      const r = await cancelarOrden(ordenId, motivo, opts);
      if (r.ok) {
        toast.success('Orden cancelada');
        setOpen(false);
        setMotivo('');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos cancelar');
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10"
      >
        <Prohibit size={14} aria-hidden />
        <span className="flex-1">Cancelar orden</span>
        <span className="text-[11px] font-normal text-muted-foreground">{resumen}</span>
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <p className="text-xs font-medium text-destructive">Cancelando: {resumen}</p>
      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        rows={3}
        maxLength={280}
        placeholder="Motivo (≥5 caracteres). Quedará en la auditoría y en notas de la orden."
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setMotivo('');
          }}
          className="h-8 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
        >
          Atrás
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="h-8 rounded-md bg-destructive px-3 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
        >
          {pending ? 'Cancelando…' : 'Confirmar cancelación'}
        </button>
      </div>
    </div>
  );
}
