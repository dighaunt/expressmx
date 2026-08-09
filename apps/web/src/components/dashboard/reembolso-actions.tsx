'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
  aprobarReembolso,
  marcarReembolsoProcesado,
  rechazarReembolso,
} from '@/lib/dashboard/actions/reembolsos';

interface Props {
  reembolsoId: string;
  estatus: string;
}

export function ReembolsoActions({ reembolsoId, estatus }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rechazoOpen, setRechazoOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [referencia, setReferencia] = useState('');
  const [procesarOpen, setProcesarOpen] = useState(false);

  function handleAprobar() {
    if (!confirm('¿Aprobar este reembolso? Quedará pendiente de procesar en la pasarela.')) return;
    startTransition(async () => {
      const r = await aprobarReembolso(reembolsoId);
      if (r.ok) {
        toast.success('Reembolso aprobado');
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
      const r = await rechazarReembolso(reembolsoId, motivo.trim());
      if (r.ok) {
        toast.success('Reembolso rechazado');
        setRechazoOpen(false);
        setMotivo('');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos rechazar');
      }
    });
  }

  function handleProcesar() {
    if (referencia.trim().length < 3) {
      toast.error('La referencia de pasarela necesita al menos 3 caracteres');
      return;
    }
    startTransition(async () => {
      const r = await marcarReembolsoProcesado(reembolsoId, referencia.trim());
      if (r.ok) {
        toast.success('Reembolso marcado como procesado');
        setProcesarOpen(false);
        setReferencia('');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos marcar como procesado');
      }
    });
  }

  if (estatus === 'solicitado') {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleAprobar}
            disabled={pending}
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-success/40 bg-success/10 px-4 text-sm font-medium text-success hover:bg-success/20 disabled:opacity-60"
          >
            <Check size={16} aria-hidden />
            Aprobar
          </button>
          {!rechazoOpen ? (
            <button
              type="button"
              onClick={() => setRechazoOpen(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <X size={16} aria-hidden />
              Rechazar
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
              placeholder="Explica al cliente por qué no procede el reembolso. Aparecerá en su ticket."
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

  if (estatus === 'aprobado') {
    return (
      <div className="space-y-3">
        {!procesarOpen ? (
          <button
            type="button"
            onClick={() => setProcesarOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Marcar como procesado
          </button>
        ) : (
          <div className="space-y-2 rounded-lg border border-border bg-card p-4">
            <label className="text-xs font-medium text-muted-foreground">
              Referencia de la pasarela
            </label>
            <input
              type="text"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ej. ch_3M..."
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-mono outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
            <p className="text-xs text-muted-foreground">
              Esta referencia se queda en el registro y permite rastrear el reembolso en la pasarela.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setProcesarOpen(false);
                  setReferencia('');
                }}
                className="h-9 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleProcesar}
                disabled={pending}
                className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                Confirmar
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
