'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Warning } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { procesarReembolsoStripe } from '@/lib/dashboard/actions/reembolsos';

interface Props {
  reembolsoId: string;
  aprobadorMatchea: boolean;
  aprobadorNombre: string | null;
  viewerNombre: string;
}

export function ReembolsoStripeButton({
  reembolsoId,
  aprobadorMatchea,
  aprobadorNombre,
  viewerNombre,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleEjecutar() {
    startTransition(async () => {
      const r = await procesarReembolsoStripe(reembolsoId);
      if (r.ok) {
        toast.success(`Reembolso ejecutado en Stripe (${r.refundId ?? ''})`);
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos ejecutar el reembolso en Stripe');
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
        <p>
          Aprobado por: <span className="font-medium">{aprobadorNombre ?? '—'}</span>
        </p>
        <p>
          Ejecutaría: <span className="font-medium">{viewerNombre}</span>
        </p>
      </div>

      {aprobadorMatchea ? (
        <div className="space-y-2">
          <button
            type="button"
            disabled
            className="inline-flex h-10 cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-muted px-4 text-sm font-medium text-muted-foreground"
            title="No puedes ejecutar un reembolso que tú mismo aprobaste"
          >
            <CreditCard size={16} aria-hidden />
            Procesar vía Stripe
          </button>
          <p className="flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning/5 p-2 text-[11px] text-warning-foreground">
            <Warning size={12} aria-hidden className="mt-0.5 shrink-0" />
            Segregación de funciones: tú aprobaste este reembolso, así que otra persona del equipo
            de finanzas debe ejecutarlo.
          </p>
        </div>
      ) : !confirmOpen ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <CreditCard size={16} aria-hidden />
            Procesar vía Stripe
          </button>
          <p className="text-[11px] text-muted-foreground">
            Esta acción es irreversible y debe ejecutarla una persona distinta a quien aprobó.
          </p>
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium">Confirmar ejecución en Stripe</p>
          <p className="text-xs text-muted-foreground">
            Se llamará a Stripe para crear el refund. El monto se descontará del cargo original y
            no se puede revertir desde aquí.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleEjecutar}
              disabled={pending}
              className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {pending ? 'Procesando…' : 'Ejecutar refund'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
