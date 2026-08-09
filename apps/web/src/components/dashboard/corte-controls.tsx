'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bank, CheckCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
  marcarCorteDepositado,
  marcarCorteRevisado,
} from '@/lib/dashboard/actions/cortes';
import type { EstatusCorte } from '@/lib/dashboard/finanzas-shared';

interface Props {
  corteId: string;
  estatus: EstatusCorte;
  referenciaInicial: string;
  fechaDepositoInicial: string;
}

export function CorteControls({
  corteId,
  estatus,
  referenciaInicial,
  fechaDepositoInicial,
}: Props) {
  const router = useRouter();
  const [referencia, setReferencia] = useState(referenciaInicial);
  const [fechaDeposito, setFechaDeposito] = useState(
    fechaDepositoInicial || new Date().toISOString().slice(0, 10),
  );
  const [pending, startTransition] = useTransition();

  function handleRevisar() {
    startTransition(async () => {
      const r = await marcarCorteRevisado(corteId);
      if (r.ok) {
        toast.success('Corte marcado como revisado');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos actualizar');
      }
    });
  }

  function handleDepositar() {
    if (referencia.trim().length < 4) {
      toast.error('Ingresa una referencia bancaria válida');
      return;
    }
    startTransition(async () => {
      const r = await marcarCorteDepositado(corteId, referencia, fechaDeposito);
      if (r.ok) {
        toast.success('Corte marcado como depositado');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos actualizar');
      }
    });
  }

  if (estatus === 'depositado') {
    return (
      <aside className="space-y-4">
        <div className="rounded-xl border border-success/40 bg-success/5 p-4">
          <p className="text-sm font-semibold text-success">Corte depositado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            El pago al prestador ya fue confirmado. No hay acciones pendientes.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="space-y-4">
      {estatus === 'generado' ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Marcar como revisado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Confirma que los montos del corte están correctos antes de programar el depósito.
          </p>
          <button
            type="button"
            onClick={handleRevisar}
            disabled={pending}
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-60"
          >
            <CheckCircle size={16} aria-hidden />
            {pending ? 'Procesando…' : 'Marcar revisado'}
          </button>
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Registrar depósito</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Captura la referencia bancaria y la fecha en la que se ejecutó la transferencia.
        </p>
        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Referencia bancaria</label>
            <input
              type="text"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="SPEI 0123-456-789"
              maxLength={120}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Fecha de depósito</label>
            <input
              type="date"
              value={fechaDeposito}
              onChange={(e) => setFechaDeposito(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <button
            type="button"
            onClick={handleDepositar}
            disabled={pending}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-success px-3 text-sm font-medium text-success-foreground transition-colors hover:bg-success/90 disabled:opacity-60"
          >
            <Bank size={16} aria-hidden />
            {pending ? 'Registrando…' : 'Registrar depósito'}
          </button>
        </div>
      </div>
    </aside>
  );
}
