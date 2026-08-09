'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import {
  asignarmeTicket,
  cambiarEstatusTicket,
  cambiarPrioridadTicket,
} from '@/lib/dashboard/actions/tickets';
import {
  ESTATUS_LABEL,
  PRIORIDAD_LABEL,
  type EstatusTicket,
  type PrioridadTicket,
} from '@/lib/dashboard/tickets-shared';

interface Props {
  ticketId: string;
  estatus: EstatusTicket;
  prioridad: PrioridadTicket;
  agenteId: string | null;
  agenteNombre: string | null;
  viewerId: string;
}

export function TicketControls({
  ticketId,
  estatus,
  prioridad,
  agenteId,
  agenteNombre,
  viewerId,
}: Props) {
  const [pending, startTransition] = useTransition();

  function handleEstatus(next: EstatusTicket) {
    startTransition(async () => {
      const r = await cambiarEstatusTicket(ticketId, next);
      if (r.ok) toast.success('Estatus actualizado');
      else toast.error(r.message ?? 'No pudimos actualizar');
    });
  }

  function handlePrioridad(next: PrioridadTicket) {
    startTransition(async () => {
      const r = await cambiarPrioridadTicket(ticketId, next);
      if (r.ok) toast.success('Prioridad actualizada');
      else toast.error(r.message ?? 'No pudimos actualizar');
    });
  }

  function handleAsignarme() {
    startTransition(async () => {
      const r = await asignarmeTicket(ticketId);
      if (r.ok) toast.success('Te asignaste el ticket');
      else toast.error(r.message ?? 'No pudimos asignarlo');
    });
  }

  const esMio = agenteId === viewerId;

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Estatus
        </label>
        <select
          value={estatus}
          onChange={(e) => handleEstatus(e.target.value as EstatusTicket)}
          disabled={pending}
          className={inputClass}
        >
          {(Object.keys(ESTATUS_LABEL) as EstatusTicket[]).map((s) => (
            <option key={s} value={s}>
              {ESTATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Prioridad
        </label>
        <select
          value={prioridad}
          onChange={(e) => handlePrioridad(e.target.value as PrioridadTicket)}
          disabled={pending}
          className={inputClass}
        >
          {(Object.keys(PRIORIDAD_LABEL) as PrioridadTicket[]).map((p) => (
            <option key={p} value={p}>
              {PRIORIDAD_LABEL[p]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Asignación
        </label>
        {agenteId ? (
          <div className="flex h-9 items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-sm">
            <span className={esMio ? 'font-medium text-primary' : ''}>
              {esMio ? 'Tú' : agenteNombre}
            </span>
            {!esMio ? (
              <button
                type="button"
                onClick={handleAsignarme}
                disabled={pending}
                className="text-xs font-medium text-primary hover:underline disabled:opacity-60"
              >
                Tomar
              </button>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleAsignarme}
            disabled={pending}
            className="h-9 w-full rounded-md border border-primary/40 bg-primary/10 px-3 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-60"
          >
            Asignármelo
          </button>
        )}
      </div>
    </div>
  );
}

const inputClass =
  'h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-60';
