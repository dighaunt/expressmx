'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  actualizarZona,
  crearZona,
  type ZonaInput,
} from '@/lib/dashboard/actions/zonas';

type Mode = 'create' | 'edit';

interface Props {
  mode: Mode;
  zonaId?: string;
  initial?: ZonaInput;
}

const EMPTY: ZonaInput = {
  nombre: '',
  centro_lat: 19.4326,
  centro_lng: -99.1332,
  radio_km: 5,
  estatus: 'activa',
};

export function ZonaForm({ mode, zonaId, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ZonaInput>({ ...EMPTY, ...initial });
  const [pending, startTransition] = useTransition();

  function update<K extends keyof ZonaInput>(key: K, value: ZonaInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r =
        mode === 'create'
          ? await crearZona(form)
          : await actualizarZona(zonaId!, form);
      if (r.ok) {
        toast.success(mode === 'create' ? 'Zona creada' : 'Zona guardada');
        if (mode === 'create' && r.id) {
          router.push(`/dashboard/zonas/${r.id}`);
        } else {
          router.refresh();
        }
      } else {
        toast.error(r.message ?? 'No pudimos guardar');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-border bg-card p-6">
      <Field label="Nombre" required>
        <input
          type="text"
          value={form.nombre}
          onChange={(e) => update('nombre', e.target.value)}
          maxLength={80}
          required
          className={inputClass}
        />
        <p className="text-xs text-muted-foreground">
          Por ejemplo: Polanco, Coyoacán, Centro CDMX.
        </p>
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Latitud del centro" required>
          <input
            type="number"
            step="0.0000001"
            min={-90}
            max={90}
            value={form.centro_lat}
            onChange={(e) => update('centro_lat', Number(e.target.value))}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Longitud del centro" required>
          <input
            type="number"
            step="0.0000001"
            min={-180}
            max={180}
            value={form.centro_lng}
            onChange={(e) => update('centro_lng', Number(e.target.value))}
            required
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Radio de cobertura (km)">
        <input
          type="number"
          min={0.5}
          max={200}
          step="0.5"
          value={form.radio_km ?? ''}
          onChange={(e) =>
            update('radio_km', e.target.value === '' ? null : Number(e.target.value))
          }
          className={inputClass}
        />
        <p className="text-xs text-muted-foreground">
          Sin radio se asume cobertura por polígono. Por ahora el polígono se gestiona aparte.
        </p>
      </Field>

      <Field label="Estado">
        <select
          value={form.estatus}
          onChange={(e) => update('estatus', e.target.value as ZonaInput['estatus'])}
          className={inputClass}
        >
          <option value="activa">Activa — recibe órdenes</option>
          <option value="en_expansion">En expansión — visible pero limitada</option>
          <option value="suspendida">Suspendida — no recibe órdenes</option>
        </select>
      </Field>

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? 'Guardando…' : mode === 'create' ? 'Crear zona' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  'h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20';

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </label>
      {children}
    </div>
  );
}
