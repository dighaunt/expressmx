'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FormattedNumberInput } from '@/components/dashboard/formatted-number-input';
import {
  actualizarComision,
  crearComision,
  type ComisionInput,
} from '@/lib/dashboard/actions/sistema';

type Mode = 'create' | 'edit';

interface Props {
  mode: Mode;
  comisionId?: string;
  initial?: Partial<ComisionInput>;
  categorias: ReadonlyArray<{ id: string; nombre: string }>;
  onDone?: () => void;
}

const TODAY = new Date().toISOString().slice(0, 10);

const EMPTY: ComisionInput = {
  categoria_id: '',
  porcentaje_base: 15,
  porcentaje_volumen: null,
  umbral_ordenes_mes: null,
  vigencia_inicio: TODAY,
  vigencia_fin: null,
  activa: true,
};

export function ComisionForm({ mode, comisionId, initial, categorias, onDone }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ComisionInput>(() => ({
    categoria_id: initial?.categoria_id ?? categorias[0]?.id ?? '',
    porcentaje_base: initial?.porcentaje_base ?? EMPTY.porcentaje_base,
    porcentaje_volumen: initial?.porcentaje_volumen ?? null,
    umbral_ordenes_mes: initial?.umbral_ordenes_mes ?? null,
    vigencia_inicio: initial?.vigencia_inicio ?? TODAY,
    vigencia_fin: initial?.vigencia_fin ?? null,
    activa: initial?.activa ?? true,
  }));
  const [pending, startTransition] = useTransition();

  function update<K extends keyof ComisionInput>(key: K, value: ComisionInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r =
        mode === 'create'
          ? await crearComision(form)
          : await actualizarComision(comisionId!, form);
      if (r.ok) {
        toast.success(mode === 'create' ? 'Comisión creada' : 'Comisión guardada');
        if (mode === 'create') {
          setForm({
            ...EMPTY,
            categoria_id: categorias[0]?.id ?? '',
          });
        }
        onDone?.();
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos guardar');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Categoría" required>
          <select
            value={form.categoria_id}
            onChange={(e) => update('categoria_id', e.target.value)}
            required
            className={inputClass}
          >
            <option value="" disabled>
              Selecciona…
            </option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Porcentaje base" required>
          <div className="relative">
            <FormattedNumberInput
              min={0}
              max={100}
              value={form.porcentaje_base}
              onValueChange={(value) => update('porcentaje_base', value ?? 0)}
              maximumFractionDigits={2}
              emptyWhenZero
              required
              className={`${inputClass} pr-7`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              %
            </span>
          </div>
        </Field>
      </div>

      <fieldset className="space-y-3 rounded-md border border-dashed border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          Tarifa por volumen (opcional)
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Porcentaje por volumen">
            <div className="relative">
              <FormattedNumberInput
                min={0}
                max={100}
                value={form.porcentaje_volumen}
                onValueChange={(value) => update('porcentaje_volumen', value)}
                maximumFractionDigits={2}
                className={`${inputClass} pr-7`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                %
              </span>
            </div>
          </Field>
          <Field label="Umbral de órdenes/mes">
            <FormattedNumberInput
              min={0}
              value={form.umbral_ordenes_mes}
              onValueChange={(value) => update('umbral_ordenes_mes', value)}
              integer
              className={inputClass}
            />
          </Field>
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Vigencia desde" required>
          <input
            type="date"
            value={form.vigencia_inicio}
            onChange={(e) => update('vigencia_inicio', e.target.value)}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Vigencia hasta">
          <input
            type="date"
            value={form.vigencia_fin ?? ''}
            onChange={(e) => update('vigencia_fin', e.target.value || null)}
            className={inputClass}
          />
        </Field>
      </div>

      <label className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
        <input
          type="checkbox"
          checked={form.activa}
          onChange={(e) => update('activa', e.target.checked)}
          className="size-4 accent-primary"
        />
        <div>
          <span className="text-sm font-medium">Comisión activa</span>
          <p className="text-xs text-muted-foreground">
            Solo las comisiones activas se aplican al calcular pagos.
          </p>
        </div>
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? 'Guardando…' : mode === 'create' ? 'Crear comisión' : 'Guardar cambios'}
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
