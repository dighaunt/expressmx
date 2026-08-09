'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CurrencyDollar } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { FormattedNumberInput } from '@/components/dashboard/formatted-number-input';
import { solicitarReembolsoInline } from '@/lib/dashboard/actions/soporte-reembolso';
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
  umbralExpressMxn: number;
  puedeAprobarExpress: boolean;
}

export function ActionRefundDialog({
  ticketId,
  pagos,
  umbralExpressMxn,
  puedeAprobarExpress,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const elegibles = pagos.filter((p) => p.estatus === 'procesado');
  const [pagoId, setPagoId] = useState<string>(elegibles[0]?.id ?? '');
  const [monto, setMonto] = useState<number | null>(
    elegibles[0]?.monto ? Number(elegibles[0].monto) : null,
  );
  const [motivo, setMotivo] = useState('');

  if (elegibles.length === 0) {
    return null;
  }

  const montoNumber = monto ?? 0;
  const dentroUmbral = puedeAprobarExpress && montoNumber > 0 && montoNumber <= umbralExpressMxn;

  function handleSubmit() {
    if (!pagoId) {
      toast.error('Selecciona un pago');
      return;
    }
    if (!Number.isFinite(montoNumber) || montoNumber <= 0) {
      toast.error('Monto inválido');
      return;
    }
    if (motivo.trim().length < 10) {
      toast.error('Motivo mínimo 10 caracteres');
      return;
    }
    startTransition(async () => {
      const r = await solicitarReembolsoInline({
        ticketId,
        pagoId,
        monto: montoNumber,
        motivo: motivo.trim(),
      });
      if (r.ok) {
        toast.success(
          r.autoAprobado
            ? `Reembolso aprobado express. Finanzas lo procesará.`
            : 'Reembolso solicitado. Esperando aprobación de finanzas.',
        );
        setOpen(false);
        setMotivo('');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos crear el reembolso');
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border border-success/40 bg-success/5 px-3 py-2 text-left text-sm font-medium text-success-foreground hover:bg-success/10"
      >
        <CurrencyDollar size={14} aria-hidden />
        <span className="flex-1">Solicitar reembolso</span>
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-success/40 bg-success/5 p-3 text-sm">
      <p className="text-xs font-medium text-success-foreground">Reembolso de pago</p>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Pago
        </span>
        <select
          value={pagoId}
          onChange={(e) => {
            setPagoId(e.target.value);
            const sel = elegibles.find((p) => p.id === e.target.value);
            if (sel) setMonto(Number(sel.monto));
          }}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        >
          {elegibles.map((p) => (
            <option key={p.id} value={p.id}>
              {formatMoneda(p.monto, true)} · {p.metodo} · orden {p.orden_id.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Monto MXN
        </span>
        <FormattedNumberInput
          min="0"
          value={monto}
          onValueChange={setMonto}
          maximumFractionDigits={2}
          emptyWhenZero
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
        <span className="text-[10px] text-muted-foreground">
          Umbral express: {formatMoneda(umbralExpressMxn, true)}.{' '}
          {dentroUmbral
            ? 'Auto-aprobado, finanzas solo procesa.'
            : 'Esperará aprobación de finanzas.'}
        </span>
      </label>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Motivo (≥10 caracteres)
        </span>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Cobro duplicado en pasarela, confirmado en logs..."
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
          className="rounded-md border border-success bg-success px-3 py-1.5 text-xs font-medium text-success-foreground hover:bg-success/90 disabled:opacity-50"
        >
          {pending ? 'Solicitando...' : dentroUmbral ? 'Aprobar express' : 'Solicitar aprobación'}
        </button>
      </div>
    </div>
  );
}
