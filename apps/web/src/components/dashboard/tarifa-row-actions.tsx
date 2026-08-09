'use client';

import { useTransition } from 'react';
import { Pause, Play, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { eliminarTarifa, toggleTarifa } from '@/lib/dashboard/actions/zonas';

interface Props {
  zonaId: string;
  tarifaId: string;
  activa: boolean;
}

export function TarifaRowActions({ zonaId, tarifaId, activa }: Props) {
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const r = await toggleTarifa(zonaId, tarifaId, !activa);
      if (r.ok) toast.success(activa ? 'Tarifa pausada' : 'Tarifa activada');
      else toast.error(r.message ?? 'No pudimos cambiar el estado');
    });
  }

  function handleDelete() {
    if (!confirm('¿Eliminar esta tarifa? No se puede deshacer.')) return;
    startTransition(async () => {
      const r = await eliminarTarifa(zonaId, tarifaId);
      if (r.ok) toast.success('Tarifa eliminada');
      else toast.error(r.message ?? 'No pudimos eliminar');
    });
  }

  return (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-muted disabled:opacity-60"
        title={activa ? 'Pausar' : 'Activar'}
      >
        {activa ? <Pause size={12} aria-hidden /> : <Play size={12} aria-hidden />}
        {activa ? 'Pausar' : 'Activar'}
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-destructive/40 bg-destructive/5 px-2 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
        title="Eliminar"
      >
        <Trash size={12} aria-hidden />
        Eliminar
      </button>
    </div>
  );
}
