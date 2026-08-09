'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowsClockwise } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { solicitarReasignacionPrestador } from '@/lib/dashboard/actions/soporte-reasignar';

interface OrdenOption {
  id: string;
  estatus: string;
  servicio_nombre: string;
}

interface Props {
  ticketId: string;
  ordenes: OrdenOption[];
}

export function ActionReassignDialog({ ticketId, ordenes }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const elegibles = ordenes.filter((o) =>
    ['solicitada', 'asignada', 'en_camino'].includes(o.estatus),
  );
  const [ordenId, setOrdenId] = useState(elegibles[0]?.id ?? '');
  const [motivo, setMotivo] = useState('');
  const [zona, setZona] = useState('');

  if (elegibles.length === 0) return null;

  function handleSubmit() {
    if (!ordenId) {
      toast.error('Selecciona una orden');
      return;
    }
    if (motivo.trim().length < 10) {
      toast.error('Motivo mínimo 10 caracteres');
      return;
    }
    startTransition(async () => {
      const r = await solicitarReasignacionPrestador({
        ticketId,
        ordenId,
        motivo: motivo.trim(),
        preferirZona: zona.trim() || undefined,
      });
      if (r.ok) {
        toast.success('Reasignación enviada a operaciones.');
        setOpen(false);
        setMotivo('');
        setZona('');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos crear la tarea');
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-left text-sm font-medium text-warning-foreground hover:bg-warning/10"
      >
        <ArrowsClockwise size={14} aria-hidden />
        <span className="flex-1">Reasignar prestador</span>
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
      <p className="text-xs font-medium text-warning-foreground">Reasignar prestador</p>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Orden
        </span>
        <select
          value={ordenId}
          onChange={(e) => setOrdenId(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        >
          {elegibles.map((o) => (
            <option key={o.id} value={o.id}>
              {o.servicio_nombre} · {o.estatus} · {o.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Preferir zona (opcional)
        </span>
        <input
          value={zona}
          onChange={(e) => setZona(e.target.value)}
          maxLength={100}
          placeholder="ej. Zona Norte, Polanco..."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
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
          placeholder="Cliente solicitó cambio porque el prestador no llegó a horario..."
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
          className="rounded-md border border-warning bg-warning px-3 py-1.5 text-xs font-medium text-warning-foreground hover:bg-warning/90 disabled:opacity-50"
        >
          {pending ? 'Enviando...' : 'Enviar a operaciones'}
        </button>
      </div>
    </div>
  );
}
