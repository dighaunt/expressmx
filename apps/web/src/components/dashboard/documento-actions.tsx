'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
  aprobarDocumento,
  rechazarDocumento,
} from '@/lib/dashboard/actions/prestadores';

interface Props {
  documentoId: string;
  estatus: string;
}

export function DocumentoActions({ documentoId, estatus }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rechazoOpen, setRechazoOpen] = useState(false);
  const [motivo, setMotivo] = useState('');

  if (estatus === 'aprobado' || estatus === 'rechazado') {
    return (
      <p className="text-xs text-muted-foreground">
        Documento ya {estatus}. Si necesitas revertirlo, pídele al prestador que suba uno nuevo.
      </p>
    );
  }

  function handleAprobar() {
    startTransition(async () => {
      const r = await aprobarDocumento(documentoId);
      if (r.ok) {
        toast.success('Documento aprobado');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos aprobar');
      }
    });
  }

  function handleRechazar() {
    if (motivo.trim().length < 5) {
      toast.error('El motivo necesita al menos 5 caracteres');
      return;
    }
    startTransition(async () => {
      const r = await rechazarDocumento(documentoId, motivo.trim());
      if (r.ok) {
        toast.success('Documento rechazado');
        setRechazoOpen(false);
        setMotivo('');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos rechazar');
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleAprobar}
          disabled={pending}
          className="inline-flex h-10 items-center gap-1.5 rounded-md border border-success/40 bg-success/10 px-4 text-sm font-medium text-success hover:bg-success/20 disabled:opacity-60"
        >
          <Check size={16} aria-hidden /> Aprobar
        </button>
        {!rechazoOpen ? (
          <button
            type="button"
            onClick={() => setRechazoOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            <X size={16} aria-hidden /> Rechazar
          </button>
        ) : null}
      </div>

      {rechazoOpen ? (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <label className="text-xs font-medium text-muted-foreground">
            Motivo del rechazo
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Explica al prestador qué falta o por qué no procede. Aparecerá en su app para que vuelva a subir."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setRechazoOpen(false);
                setMotivo('');
              }}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleRechazar}
              disabled={pending}
              className="h-9 rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
            >
              Confirmar rechazo
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
