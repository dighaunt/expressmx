'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LockOpen } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { reactivarCuenta } from '@/lib/dashboard/actions/soporte-suspender';

interface Props {
  suspensionId: string;
}

export function ActionReactivateButton({ suspensionId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [motivo, setMotivo] = useState('');

  function handleSubmit() {
    if (motivo.trim().length < 5) {
      toast.error('Motivo mínimo 5 caracteres');
      return;
    }
    startTransition(async () => {
      const r = await reactivarCuenta({ suspensionId, motivo: motivo.trim() });
      if (r.ok) {
        toast.success('Cuenta reactivada');
        setOpen(false);
        setMotivo('');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos reactivar');
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
        <LockOpen size={14} aria-hidden />
        <span className="flex-1">Reactivar cuenta</span>
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-success/40 bg-success/5 p-3 text-sm">
      <p className="text-xs font-medium text-success-foreground">Reactivar cuenta</p>
      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Por qué se reactiva (verificación completada, decisión, etc.)..."
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
      />
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
          {pending ? 'Reactivando...' : 'Reactivar'}
        </button>
      </div>
    </div>
  );
}
