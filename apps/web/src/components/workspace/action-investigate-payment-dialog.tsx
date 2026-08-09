'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { crearTareaInvestigacionPago } from '@/lib/dashboard/actions/soporte-pago-investigar';
import { formatMoneda } from '@/lib/dashboard/format';

interface PagoOption {
  id: string;
  monto: string;
  metodo: string;
  estatus: string;
  orden_id: string;
}

interface Props {
  ticketId: string;
  pagos: PagoOption[];
}

export function ActionInvestigatePaymentDialog({ ticketId, pagos }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const candidatos = pagos.filter(
    (p) => p.estatus === 'pendiente' || p.estatus === 'fallido',
  );
  const [pagoId, setPagoId] = useState<string>(candidatos[0]?.id ?? '');
  const [motivo, setMotivo] = useState('');

  if (candidatos.length === 0) {
    return null;
  }

  function handleSubmit() {
    if (!pagoId) {
      toast.error('Selecciona el pago a investigar');
      return;
    }
    if (motivo.trim().length < 10) {
      toast.error('Describe el motivo (mínimo 10 caracteres)');
      return;
    }
    startTransition(async () => {
      const r = await crearTareaInvestigacionPago({
        ticketId,
        pagoId,
        motivo: motivo.trim(),
      });
      if (r.ok) {
        toast.success('Investigación enviada a finanzas');
        setOpen(false);
        setMotivo('');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos crear la investigación');
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-left text-sm font-medium text-warning-foreground hover:bg-warning/10"
      >
        <MagnifyingGlass size={14} aria-hidden />
        <span className="flex-1">Investigar pago (derivar a finanzas)</span>
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
      <p className="text-xs font-medium text-warning-foreground">
        Crear tarea de investigación
      </p>
      <p className="text-[11px] text-muted-foreground">
        Finanzas reconciliará el pago contra Stripe y decidirá si fue cobro real o no
        se cobró. El ticket queda en espera mientras tanto.
      </p>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Pago a investigar
        </span>
        <select
          value={pagoId}
          onChange={(e) => setPagoId(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        >
          {candidatos.map((p) => (
            <option key={p.id} value={p.id}>
              {formatMoneda(p.monto, true)} · {p.metodo} · {p.estatus} · orden{' '}
              {p.orden_id.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Motivo (≥10 caracteres)
        </span>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Cliente dice que ya pagó pero la app sigue pidiendo cobro; webhook no llegó..."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </label>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/40"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="rounded-md border border-warning bg-warning px-3 py-1.5 text-xs font-medium text-warning-foreground hover:bg-warning/90 disabled:opacity-50"
        >
          {pending ? 'Enviando...' : 'Enviar a finanzas'}
        </button>
      </div>
    </div>
  );
}
