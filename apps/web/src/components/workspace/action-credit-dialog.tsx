'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { FormattedNumberInput } from '@/components/dashboard/formatted-number-input';
import { aplicarCredito } from '@/lib/dashboard/actions/soporte-credito';
import { formatMoneda } from '@/lib/dashboard/format';

interface Props {
  ticketId: string;
  clienteId: string;
  umbralExpressMxn: number;
  puedeSinAprobacion: boolean;
  capServicioMxn?: number | null;
  factorServicio?: number | null;
}

const TIPOS = [
  { value: 'credito_compensacion', label: 'Compensación por incidente' },
  { value: 'credito_manual', label: 'Crédito manual (otro)' },
] as const;

type TipoCredito = (typeof TIPOS)[number]['value'];

export function ActionCreditDialog({
  ticketId,
  clienteId,
  umbralExpressMxn,
  puedeSinAprobacion,
  capServicioMxn,
  factorServicio,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [monto, setMonto] = useState<number | null>(null);
  const [tipo, setTipo] = useState<TipoCredito>('credito_compensacion');
  const [motivo, setMotivo] = useState('');

  const montoNumber = monto ?? 0;
  const dentroUmbral = montoNumber > 0 && montoNumber <= umbralExpressMxn;
  const autoAprobado = puedeSinAprobacion || dentroUmbral;
  const tieneCap =
    typeof capServicioMxn === 'number' && Number.isFinite(capServicioMxn) && capServicioMxn >= 0;
  const excedeCap = tieneCap && montoNumber > 0 && montoNumber > (capServicioMxn as number);
  const bloqueadoPorCap = excedeCap && !puedeSinAprobacion;

  function handleSubmit() {
    if (!Number.isFinite(montoNumber) || montoNumber <= 0) {
      toast.error('Monto inválido');
      return;
    }
    if (motivo.trim().length < 10) {
      toast.error('Motivo mínimo 10 caracteres');
      return;
    }
    startTransition(async () => {
      const r = await aplicarCredito({
        ticketId,
        clienteId,
        monto: montoNumber,
        tipo,
        motivo: motivo.trim(),
      });
      if (r.ok) {
        toast.success(
          r.autoAprobado
            ? `Crédito ${formatMoneda(montoNumber, true)} aplicado al cliente.`
            : 'Crédito esperando aprobación de finanzas.',
        );
        setOpen(false);
        setMonto(null);
        setMotivo('');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos aplicar el crédito');
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border border-info/40 bg-info/5 px-3 py-2 text-left text-sm font-medium text-info-foreground hover:bg-info/10"
      >
        <Wallet size={14} aria-hidden />
        <span className="flex-1">Aplicar crédito en cuenta</span>
      </button>
    );
  }

  const montoBorderClass = excedeCap
    ? 'border-amber-500 focus:border-amber-500 focus:ring-amber-500/20'
    : 'border-border focus:border-ring focus:ring-ring/20';

  return (
    <div className="space-y-2 rounded-md border border-info/40 bg-info/5 p-3 text-sm">
      <p className="text-xs font-medium text-info-foreground">Crédito en cuenta</p>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Tipo
        </span>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoCredito)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        >
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
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
          className={`w-full rounded-md border bg-background px-3 py-2 text-xs outline-none focus:ring-2 ${montoBorderClass}`}
        />
        {tieneCap ? (
          <span className="block text-[10px] text-muted-foreground">
            Máximo {formatMoneda(capServicioMxn as number, true)} según el valor del servicio
            {typeof factorServicio === 'number' && Number.isFinite(factorServicio)
              ? ` (factor ${factorServicio}×)`
              : ''}
            .
          </span>
        ) : null}
        <span className="block text-[10px] text-muted-foreground">
          Umbral express: {formatMoneda(umbralExpressMxn, true)}.{' '}
          {autoAprobado ? 'Se aplica de inmediato.' : 'Esperará aprobación de finanzas.'}
        </span>
        {excedeCap ? (
          <span className="block text-[10px] font-medium text-amber-600">
            {bloqueadoPorCap
              ? `Excede el cap del servicio (${formatMoneda(capServicioMxn as number, true)}). El servidor lo rechazará.`
              : `Excede el cap del servicio (${formatMoneda(capServicioMxn as number, true)}). Tu rol permite saltar el cap.`}
          </span>
        ) : null}
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
          placeholder="Cliente reportó tiempo perdido por demora del prestador..."
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
          className="rounded-md border border-info bg-info px-3 py-1.5 text-xs font-medium text-info-foreground hover:bg-info/90 disabled:opacity-50"
        >
          {pending ? 'Aplicando...' : autoAprobado ? 'Aplicar' : 'Solicitar aprobación'}
        </button>
      </div>
    </div>
  );
}
