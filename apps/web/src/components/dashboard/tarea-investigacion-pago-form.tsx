'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { resolverInvestigacionPago } from '@/lib/dashboard/actions/soporte-pago-investigar';

interface Props {
  tareaId: string;
  estado: string;
}

type Decision = 'cobro_real' | 'cobro_fallido';

export function TareaInvestigacionPagoForm({ tareaId, estado }: Props) {
  const router = useRouter();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [notas, setNotas] = useState('');
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!decision) return;
    if (notas.trim().length < 10) {
      toast.error('Las notas son obligatorias (mínimo 10 caracteres)');
      return;
    }
    startTransition(async () => {
      const r = await resolverInvestigacionPago({
        tareaId,
        decision,
        notas: notas.trim(),
      });
      if (r.ok) {
        toast.success(
          decision === 'cobro_real'
            ? 'Pago reconciliado vs Stripe'
            : 'Pago marcado como no cobrado',
        );
        setDecision(null);
        setNotas('');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos resolver la investigación');
      }
    });
  }

  if (estado === 'completada' || estado === 'cancelada') {
    return null;
  }

  if (!decision) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <button
          type="button"
          onClick={() => setDecision('cobro_real')}
          className="inline-flex items-center gap-1 rounded-md border border-success bg-success/10 px-2 py-1 text-[11px] font-medium text-success hover:bg-success/20"
        >
          <CheckCircle size={12} weight="bold" aria-hidden /> Cobro confirmado
        </button>
        <button
          type="button"
          onClick={() => setDecision('cobro_fallido')}
          className="inline-flex items-center gap-1 rounded-md border border-destructive bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/20"
        >
          <XCircle size={12} weight="bold" aria-hidden /> No se cobró
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-background p-2 min-w-[260px]">
      <p className="text-[11px] font-semibold">
        {decision === 'cobro_real'
          ? 'Confirmar cobro real (reconcilia con Stripe)'
          : 'Marcar pago como no cobrado'}
      </p>
      <p className="text-[10px] text-muted-foreground">
        {decision === 'cobro_real'
          ? 'Se consultará Stripe para verificar el estado del PaymentIntent y se actualizará el pago en BD.'
          : 'El pago quedará en estatus "fallido". Notifica al cliente que puede reintentar el cobro.'}
      </p>
      <textarea
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Notas para auditoría: monto verificado, conversación con cliente, etc."
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setDecision(null);
            setNotas('');
          }}
          disabled={pending}
          className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted/40"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className={
            decision === 'cobro_real'
              ? 'rounded-md border border-success bg-success px-2 py-1 text-[11px] font-medium text-success-foreground hover:bg-success/90 disabled:opacity-50'
              : 'rounded-md border border-destructive bg-destructive px-2 py-1 text-[11px] font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50'
          }
        >
          {pending ? '...' : 'Confirmar'}
        </button>
      </div>
    </div>
  );
}
