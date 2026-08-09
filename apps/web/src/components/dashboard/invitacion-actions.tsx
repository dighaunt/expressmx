'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Plus, Prohibit } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
  extenderInvitacion,
  revocarInvitacion,
} from '@/lib/dashboard/actions/invitaciones';

interface Props {
  invitacionId: string;
  codigo: string;
  estado: 'disponible' | 'usada' | 'revocada' | 'expirada';
}

export function InvitacionActions({ invitacionId, codigo, estado }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [extender, setExtender] = useState(7);

  function handleRevocar() {
    if (!confirm('¿Revocar esta invitación? El código deja de funcionar inmediatamente.')) return;
    startTransition(async () => {
      const r = await revocarInvitacion(invitacionId);
      if (r.ok) {
        toast.success('Invitación revocada');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos revocar');
      }
    });
  }

  function handleExtender() {
    startTransition(async () => {
      const r = await extenderInvitacion(invitacionId, extender);
      if (r.ok) {
        toast.success(`Vigencia extendida ${extender} días`);
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos extender');
      }
    });
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      toast.success('Código copiado');
    } catch {
      toast.error('No pudimos copiar');
    }
  }

  if (estado !== 'disponible') {
    return (
      <p className="text-xs text-muted-foreground">
        Esta invitación está {estado}. No hay acciones disponibles.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={copiar}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
      >
        <Copy size={14} aria-hidden /> Copiar código
      </button>

      <div className="space-y-2 rounded-md border border-border bg-card p-3">
        <p className="text-xs font-medium">Extender vigencia</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={30}
            value={extender}
            onChange={(e) => setExtender(Math.max(1, Math.min(30, Number(e.target.value) || 7)))}
            className="h-8 w-20 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
          <span className="text-xs text-muted-foreground">días extra</span>
          <button
            type="button"
            onClick={handleExtender}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-60"
          >
            <Plus size={12} aria-hidden /> Extender
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleRevocar}
        disabled={pending}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 px-3 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
      >
        <Prohibit size={14} aria-hidden /> Revocar invitación
      </button>
    </div>
  );
}
