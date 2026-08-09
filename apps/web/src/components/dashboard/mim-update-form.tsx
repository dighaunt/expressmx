'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Megaphone } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { publicarUpdateMim } from '@/lib/dashboard/actions/mim-crud';
import {
  ESTADO_MIM_LABEL,
  siguientesEstadosMim,
  type EstadoMim,
} from '@/lib/dashboard/mim-shared';

interface Props {
  mimId: string;
  estadoActual: EstadoMim;
  pirUrlActual: string | null;
  puedeCerrar: boolean;
}

export function MimUpdateForm({
  mimId,
  estadoActual,
  pirUrlActual,
  puedeCerrar,
}: Props) {
  const router = useRouter();
  const [contenido, setContenido] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState<EstadoMim | ''>('');
  const [pirUrl, setPirUrl] = useState(pirUrlActual ?? '');
  const [pending, startTransition] = useTransition();

  const transiciones = siguientesEstadosMim(estadoActual);
  const transicionesPermitidas = puedeCerrar
    ? transiciones
    : transiciones.filter((t) => t !== 'cerrado');
  const requierePir =
    nuevoEstado === 'cerrado' || estadoActual === 'pir_pendiente';

  function handleSubmit() {
    if (contenido.trim().length < 20) {
      toast.error('El update debe tener al menos 20 caracteres');
      return;
    }
    if (nuevoEstado === 'cerrado' && pirUrl.trim().length === 0) {
      toast.error('Para cerrar el MIM necesitas el PIR URL');
      return;
    }
    startTransition(async () => {
      const payload: Parameters<typeof publicarUpdateMim>[0] = {
        mimId,
        contenido: contenido.trim(),
      };
      if (nuevoEstado) payload.nuevoEstado = nuevoEstado;
      if (pirUrl.trim()) payload.pirUrl = pirUrl.trim();
      const r = await publicarUpdateMim(payload);
      if (r.ok) {
        toast.success('Update publicado');
        setContenido('');
        setNuevoEstado('');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No se pudo publicar el update');
      }
    });
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-background p-4">
      <div className="flex items-center gap-2">
        <Megaphone size={16} weight="duotone" aria-hidden />
        <h3 className="text-sm font-semibold">Publicar update</h3>
      </div>

      <textarea
        value={contenido}
        onChange={(e) => setContenido(e.target.value)}
        rows={4}
        maxLength={4000}
        placeholder="Estatus, hallazgos y próximos pasos. Markdown permitido."
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
      />

      {transicionesPermitidas.length > 0 ? (
        <label className="block text-xs">
          <span className="font-medium">Cambiar estado (opcional)</span>
          <select
            value={nuevoEstado}
            onChange={(e) => setNuevoEstado(e.target.value as EstadoMim | '')}
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            <option value="">Sin cambio</option>
            {transicionesPermitidas.map((t) => (
              <option key={t} value={t}>
                {ESTADO_MIM_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {requierePir ? (
        <label className="block text-xs">
          <span className="font-medium">PIR URL</span>
          <input
            value={pirUrl}
            onChange={(e) => setPirUrl(e.target.value)}
            type="url"
            placeholder="https://docs.example.com/pir/2026-05-05"
            maxLength={500}
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </label>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? 'Publicando…' : 'Publicar update'}
        </button>
      </div>
    </div>
  );
}
