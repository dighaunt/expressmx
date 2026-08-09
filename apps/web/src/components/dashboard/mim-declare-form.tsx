'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { WarningOctagon } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { declararMim } from '@/lib/dashboard/actions/mim-crud';

export function MimDeclareForm() {
  const router = useRouter();
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [serviciosRaw, setServiciosRaw] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    if (titulo.trim().length < 8) {
      toast.error('El título debe tener al menos 8 caracteres');
      return;
    }
    if (descripcion.trim().length < 20) {
      toast.error('La descripción debe tener al menos 20 caracteres');
      return;
    }
    const servicios = serviciosRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    startTransition(async () => {
      const r = await declararMim({
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        servicios_afectados: servicios,
        zonas_afectadas: [],
      });
      if (r.ok && r.data) {
        toast.success('Major Incident declarado');
        router.push(`/dashboard/soporte/mim/${r.data.id}`);
      } else {
        toast.error(r.message ?? 'No se pudo declarar');
      }
    });
  }

  return (
    <div className="space-y-4 rounded-md border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <WarningOctagon
          size={20}
          weight="fill"
          className="shrink-0 text-destructive"
          aria-hidden
        />
        <div>
          <h2 className="text-sm font-semibold text-destructive">
            Declarar Major Incident
          </h2>
          <p className="text-xs text-muted-foreground">
            Esto activa el banner global y abre la war room. La acción queda en auditoría.
          </p>
        </div>
      </div>

      <label className="block text-xs">
        <span className="font-medium">Título</span>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={200}
          placeholder="Ej. Fallos masivos en pagos con Stripe"
          className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </label>

      <label className="block text-xs">
        <span className="font-medium">Descripción inicial</span>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={5}
          maxLength={4000}
          placeholder="¿Qué se está observando? Síntomas, alcance, primeras hipótesis."
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </label>

      <label className="block text-xs">
        <span className="font-medium">Servicios afectados (separados por coma)</span>
        <input
          value={serviciosRaw}
          onChange={(e) => setServiciosRaw(e.target.value)}
          placeholder="pagos, app-cliente, panel-prestador"
          className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </label>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="h-9 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
        >
          {pending ? 'Declarando…' : 'Declarar Major Incident'}
        </button>
      </div>
    </div>
  );
}
