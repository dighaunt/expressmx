'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
  aprobarSolicitud,
  rechazarSolicitud,
} from '@/lib/dashboard/actions/aprobaciones';

interface Props {
  aprobacionId: string;
}

export function AprobacionDecidirForm({ aprobacionId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<'aprobar' | 'rechazar' | null>(null);
  const [notas, setNotas] = useState('');

  function handleSubmit(decision: 'aprobar' | 'rechazar') {
    if (notas.trim().length < 5) {
      toast.error('Notas mínimo 5 caracteres');
      return;
    }
    startTransition(async () => {
      const fn = decision === 'aprobar' ? aprobarSolicitud : rechazarSolicitud;
      const r = await fn({ aprobacionId, notas: notas.trim() });
      if (r.ok) {
        toast.success(decision === 'aprobar' ? 'Aprobada' : 'Rechazada');
        setOpen(null);
        setNotas('');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos decidir');
      }
    });
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen('aprobar')}
          className="inline-flex items-center gap-1 rounded-md border border-success bg-success/10 px-2 py-1 text-[11px] font-medium text-success hover:bg-success/20"
        >
          <CheckCircle size={12} weight="fill" aria-hidden /> Aprobar
        </button>
        <button
          type="button"
          onClick={() => setOpen('rechazar')}
          className="inline-flex items-center gap-1 rounded-md border border-destructive bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/20"
        >
          <XCircle size={12} weight="fill" aria-hidden /> Rechazar
        </button>
      </div>
    );
  }

  const isAprobar = open === 'aprobar';
  return (
    <div className="space-y-2 rounded-md border border-border bg-background p-2">
      <p className="text-[11px] font-medium">
        {isAprobar ? 'Aprobar solicitud' : 'Rechazar solicitud'}
      </p>
      <textarea
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder={isAprobar ? 'Notas de aprobación' : 'Razón del rechazo'}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(null)}
          disabled={pending}
          className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted/40"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(open)}
          disabled={pending}
          className={`rounded-md border px-2 py-1 text-[11px] font-medium disabled:opacity-50 ${
            isAprobar
              ? 'border-success bg-success text-success-foreground hover:bg-success/90'
              : 'border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90'
          }`}
        >
          {pending ? '...' : isAprobar ? 'Confirmar aprobación' : 'Confirmar rechazo'}
        </button>
      </div>
    </div>
  );
}
