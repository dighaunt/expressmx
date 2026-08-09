'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
  actualizarTitularCuentaBancariaPrestador,
  guardarCuentaBancariaPrestador,
  rechazarCuentaBancariaPrestador,
  verificarCuentaBancariaPrestador,
} from '@/lib/dashboard/actions/prestadores';

interface Props {
  prestadorId: string;
  cuentaId: string | null;
  estatus: 'pendiente' | 'verificada' | 'rechazada' | null;
  titularInicial?: string | null;
  bancoInicial?: string | null;
}

export function CuentaBancariaActions({
  prestadorId,
  cuentaId,
  estatus,
  titularInicial,
  bancoInicial,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rechazoOpen, setRechazoOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [titular, setTitular] = useState(titularInicial ?? '');
  const [clabe, setClabe] = useState('');
  const [motivo, setMotivo] = useState('');

  function handleGuardar() {
    startTransition(async () => {
      const clabeNormalizada = clabe.replace(/\D/g, '');
      const r =
        cuentaId && clabeNormalizada.length === 0
          ? await actualizarTitularCuentaBancariaPrestador(cuentaId, { titular })
          : await guardarCuentaBancariaPrestador(prestadorId, {
              titular,
              clabe: clabeNormalizada,
            });
      if (r.ok) {
        toast.success('Cuenta bancaria guardada');
        setFormOpen(false);
        setClabe('');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos guardar');
      }
    });
  }

  function handleVerificar() {
    if (!cuentaId) return;
    startTransition(async () => {
      const r = await verificarCuentaBancariaPrestador(cuentaId);
      if (r.ok) {
        toast.success('Cuenta verificada');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos verificar');
      }
    });
  }

  function handleRechazar() {
    if (!cuentaId) return;
    if (motivo.trim().length < 5) {
      toast.error('El motivo necesita al menos 5 caracteres');
      return;
    }
    startTransition(async () => {
      const r = await rechazarCuentaBancariaPrestador(cuentaId, motivo.trim());
      if (r.ok) {
        toast.success('Cuenta rechazada');
        setRechazoOpen(false);
        setMotivo('');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos rechazar');
      }
    });
  }

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted disabled:opacity-60"
        >
          {cuentaId ? 'Actualizar cuenta' : 'Capturar cuenta'}
        </button>
        {cuentaId && estatus !== 'verificada' ? (
          <button
            type="button"
            onClick={handleVerificar}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-success/40 bg-success/10 px-3 text-sm font-medium text-success hover:bg-success/20 disabled:opacity-60"
          >
            <Check size={14} aria-hidden /> Verificar
          </button>
        ) : null}
        {cuentaId && !rechazoOpen ? (
          <button
            type="button"
            onClick={() => setRechazoOpen(true)}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 px-3 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
          >
            <X size={14} aria-hidden /> Rechazar
          </button>
        ) : null}
      </div>

      {formOpen ? (
        <div className="grid gap-3 rounded-md border border-border bg-muted/30 p-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Titular
            <input
              value={titular}
              onChange={(e) => setTitular(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </label>
          {bancoInicial ? (
            <div className="space-y-1 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
              <p className="font-medium">Banco actual</p>
              <p className="text-sm font-semibold text-foreground">{bancoInicial}</p>
            </div>
          ) : null}
          <label className="space-y-1 text-xs font-medium text-muted-foreground sm:col-span-2">
            {cuentaId ? 'Nueva CLABE' : 'CLABE'}
            <input
              value={clabe}
              onChange={(e) => setClabe(e.target.value.replace(/\D/g, '').slice(0, 18))}
              inputMode="numeric"
              maxLength={18}
              placeholder="18 dígitos"
              className="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setClabe('');
              }}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGuardar}
              disabled={pending}
              className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              Guardar
            </button>
          </div>
        </div>
      ) : null}

      {rechazoOpen ? (
        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <label className="text-xs font-medium text-muted-foreground">Motivo del rechazo</label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="Ej. CLABE no coincide con el titular o comprobante bancario."
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
