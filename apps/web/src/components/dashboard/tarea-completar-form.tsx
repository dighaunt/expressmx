'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Play } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
  completarTareaConSideEffects,
  marcarEnProgreso,
} from '@/lib/dashboard/actions/tareas-bandeja';

interface PrestadorOption {
  id: string;
  nombre: string;
  rating: string | null;
  ordenes_completadas: number;
  ofrece_servicio: boolean;
  distancia_km: string | null;
}

interface Props {
  tareaId: string;
  tipo: string;
  estado: string;
  payloadSubtipo?: string | null | undefined;
  prestadoresCandidatos?: PrestadorOption[] | undefined;
}

const TIPOS_CON_ACUSE_SAT = new Set(['cfdi_cancelacion', 'cfdi_reemision']);

export function TareaCompletarForm({
  tareaId,
  tipo,
  estado,
  payloadSubtipo,
  prestadoresCandidatos,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState('');
  const [acuseSat, setAcuseSat] = useState('');
  const [prestadorNuevoId, setPrestadorNuevoId] = useState(
    prestadoresCandidatos?.[0]?.id ?? '',
  );
  const [referenciaPago, setReferenciaPago] = useState('');

  const requiereAcuseSat = TIPOS_CON_ACUSE_SAT.has(tipo);
  const requierePrestador = tipo === 'reasignar_prestador';
  const sugiereReferencia = tipo === 'reembolso';
  const esSuspensionPendiente =
    tipo === 'follow_up_interno' && payloadSubtipo === 'suspension_pendiente';

  function handleStart() {
    startTransition(async () => {
      const r = await marcarEnProgreso({ tareaId });
      if (r.ok) {
        toast.success('Marcada en progreso');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos marcar');
      }
    });
  }

  function handleSubmit() {
    if (resultado.trim().length < 5) {
      toast.error('Describe el resultado (mínimo 5 caracteres)');
      return;
    }
    if (requiereAcuseSat && acuseSat.trim().length < 3) {
      toast.error('Captura el folio de acuse SAT');
      return;
    }
    if (requierePrestador && !prestadorNuevoId) {
      toast.error('Selecciona el prestador nuevo');
      return;
    }

    const payloadEjecucion: {
      acuseSat?: string;
      prestadorNuevoId?: string;
      referenciaPago?: string;
    } = {};
    if (requiereAcuseSat) payloadEjecucion.acuseSat = acuseSat.trim();
    if (requierePrestador) payloadEjecucion.prestadorNuevoId = prestadorNuevoId;
    if (sugiereReferencia && referenciaPago.trim().length > 0)
      payloadEjecucion.referenciaPago = referenciaPago.trim();

    startTransition(async () => {
      const r = await completarTareaConSideEffects({
        tareaId,
        resultado: resultado.trim(),
        payloadEjecucion:
          Object.keys(payloadEjecucion).length > 0 ? payloadEjecucion : undefined,
      });
      if (r.ok) {
        toast.success('Tarea completada');
        setOpen(false);
        setResultado('');
        setAcuseSat('');
        setReferenciaPago('');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos completar');
      }
    });
  }

  if (!open) {
    return (
      <div className="flex items-center gap-1.5">
        {estado === 'abierta' ? (
          <button
            type="button"
            onClick={handleStart}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md border border-info bg-info/10 px-2 py-1 text-[11px] font-medium text-info hover:bg-info/20 disabled:opacity-50"
          >
            <Play size={12} weight="bold" aria-hidden /> En progreso
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded-md border border-success bg-success/10 px-2 py-1 text-[11px] font-medium text-success hover:bg-success/20"
        >
          <Check size={12} weight="bold" aria-hidden /> Completar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-background p-2">
      {esSuspensionPendiente ? (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-[11px] text-warning-foreground">
          Aprobar esta tarea creará la suspensión real y bloqueará al usuario.
        </p>
      ) : null}

      {requierePrestador ? (
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Prestador nuevo
          </span>
          <select
            value={prestadorNuevoId}
            onChange={(e) => setPrestadorNuevoId(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            <option value="" disabled>
              Selecciona prestador
            </option>
            {(prestadoresCandidatos ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
                {p.rating ? ` · ${p.rating}` : ''}
                {p.distancia_km ? ` · ${p.distancia_km} km` : ''}
                {p.ofrece_servicio ? ' · servicio activo' : ''}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {requiereAcuseSat ? (
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Folio de acuse SAT
          </span>
          <input
            value={acuseSat}
            onChange={(e) => setAcuseSat(e.target.value)}
            maxLength={200}
            placeholder="UUID o folio del acuse"
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </label>
      ) : null}

      {sugiereReferencia ? (
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Referencia pasarela (opcional)
          </span>
          <input
            value={referenciaPago}
            onChange={(e) => setReferenciaPago(e.target.value)}
            maxLength={200}
            placeholder="Stripe id, OXXO ref, etc."
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </label>
      ) : null}

      <textarea
        value={resultado}
        onChange={(e) => setResultado(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Describe qué se hizo, monto procesado, evidencia..."
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted/40"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="rounded-md border border-success bg-success px-2 py-1 text-[11px] font-medium text-success-foreground hover:bg-success/90 disabled:opacity-50"
        >
          {pending ? '...' : 'Completar'}
        </button>
      </div>
    </div>
  );
}
