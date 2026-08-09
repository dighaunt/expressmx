'use client';

import { useState, useTransition } from 'react';
import { Copy, Key } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { forzarCambioPassword } from '@/lib/dashboard/actions/soporte';

interface Props {
  casoId: string;
}

export function ForzarPasswordForm({ casoId }: Props) {
  const [resultado, setResultado] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        'Esto invalida la contraseña actual del cliente y genera una nueva. Tendrás que dictarsela. ¿Continuar?',
      )
    ) {
      return;
    }
    startTransition(async () => {
      const r = await forzarCambioPassword(casoId);
      if (r.ok && r.nuevoPassword) {
        setResultado(r.nuevoPassword);
        toast.success('Password generada. Dícsela al cliente.');
      } else {
        toast.error(r.message ?? 'No pudimos forzar el cambio');
      }
    });
  }

  async function copiar() {
    if (!resultado) return;
    try {
      await navigator.clipboard.writeText(resultado);
      toast.success('Copiado');
    } catch {
      toast.error('No pudimos copiar');
    }
  }

  if (resultado) {
    return (
      <div className="space-y-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
        <p className="text-xs font-medium text-warning-foreground">
          Password temporal del cliente:
        </p>
        <p className="font-mono text-base font-bold tracking-wider">{resultado}</p>
        <p className="text-xs text-muted-foreground">
          Solo se muestra una vez. Dícsela al cliente y pídele que la cambie en cuanto entre.
        </p>
        <button
          type="button"
          onClick={copiar}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
        >
          <Copy size={12} aria-hidden /> Copiar
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="flex w-full items-center gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-left text-sm font-medium text-warning-foreground hover:bg-warning/10 disabled:opacity-60"
    >
      <Key size={14} aria-hidden />
      <span className="flex-1">Forzar cambio de password</span>
      <span className="text-[11px] font-normal text-muted-foreground">vía caso PIN</span>
    </button>
  );
}
