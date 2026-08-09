'use client';

import { useTransition } from 'react';
import { Copy, ProhibitInset } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { revocarInvitacion } from '@/lib/dashboard/actions/invitaciones';

export function InvitacionRowActions({
  invitacionId,
  codigo,
}: {
  invitacionId: string;
  codigo: string;
}) {
  const [pending, startTransition] = useTransition();

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      toast.success(`Código ${codigo} copiado`);
    } catch {
      toast.error('No pudimos copiar al portapapeles');
    }
  }

  function revocar() {
    if (!confirm(`¿Revocar el código ${codigo}? Ya no se podrá usar para registrarse.`)) {
      return;
    }
    startTransition(async () => {
      const r = await revocarInvitacion(invitacionId);
      if (r.ok) {
        toast.success('Invitación revocada');
      } else {
        toast.error(r.message ?? 'No pudimos revocar');
      }
    });
  }

  return (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        onClick={copiar}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-muted"
        title="Copiar código"
      >
        <Copy size={12} aria-hidden />
        Copiar
      </button>
      <button
        type="button"
        onClick={revocar}
        disabled={pending}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-destructive/40 bg-destructive/5 px-2 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
        title="Revocar invitación"
      >
        <ProhibitInset size={12} aria-hidden />
        Revocar
      </button>
    </div>
  );
}
