'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FormattedNumberInput } from '@/components/dashboard/formatted-number-input';
import {
  actualizarServicio,
  crearServicio,
  type ServicioInput,
} from '@/lib/dashboard/actions/catalogo';
import { cn } from '@/lib/utils';

interface CategoriaOption {
  id: string;
  nombre: string;
}

type Mode = 'create' | 'edit';

interface Props {
  mode?: Mode;
  servicioId?: string;
  initial: ServicioInput;
  categorias: ReadonlyArray<CategoriaOption>;
  canEdit: boolean;
}

export function ServicioEditForm({
  mode = 'edit',
  servicioId,
  initial,
  categorias,
  canEdit,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ServicioInput>(initial);
  const [pending, startTransition] = useTransition();

  function update<K extends keyof ServicioInput>(key: K, value: ServicioInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    startTransition(async () => {
      const r =
        mode === 'create'
          ? await crearServicio(form)
          : await actualizarServicio(servicioId!, form);
      if (r.ok) {
        toast.success(mode === 'create' ? 'Servicio creado' : 'Servicio guardado');
        if (mode === 'create' && 'id' in r && r.id) {
          router.push(`/dashboard/servicios/${r.id}`);
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
      <fieldset disabled={!canEdit} className="space-y-5">
        <Field label="Nombre" required>
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => update('nombre', e.target.value)}
            maxLength={120}
            required
            className={inputClass}
          />
        </Field>

        <Field label="Descripción">
          <textarea
            value={form.descripcion ?? ''}
            onChange={(e) => update('descripcion', e.target.value)}
            rows={3}
            maxLength={500}
            className={cn(inputClass, 'h-auto py-2')}
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Precio base (MXN)" required>
            <FormattedNumberInput
              min={0}
              max={99999}
              value={form.precio_base}
              onValueChange={(value) => update('precio_base', value ?? 0)}
              maximumFractionDigits={2}
              emptyWhenZero={mode === 'create'}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Precio máximo (opcional)">
            <FormattedNumberInput
              min={0}
              max={99999}
              value={form.precio_maximo}
              onValueChange={(value) => update('precio_maximo', value)}
              maximumFractionDigits={2}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Duración estimada (min)">
            <FormattedNumberInput
              min={0}
              max={1440}
              value={form.duracion_estimada_min}
              onValueChange={(value) => update('duracion_estimada_min', value)}
              integer
              className={inputClass}
            />
          </Field>
          <Field label="Categoría" required>
            <select
              value={form.categoria_id}
              onChange={(e) => update('categoria_id', e.target.value)}
              required
              className={inputClass}
            >
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <label className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
          <input
            type="checkbox"
            checked={form.activo}
            onChange={(e) => update('activo', e.target.checked)}
            className="size-4 accent-primary"
          />
          <div>
            <span className="text-sm font-medium">Servicio activo</span>
            <p className="text-xs text-muted-foreground">
              Cuando está inactivo no aparece en la app del cliente ni se asigna a prestadores.
            </p>
          </div>
        </label>

        {canEdit ? (
          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={pending}
              className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {pending ? 'Guardando…' : mode === 'create' ? 'Crear servicio' : 'Guardar cambios'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Tu rol no permite editar el catálogo. Solo puedes ver.
          </p>
        )}
      </fieldset>
    </form>
  );
}

const inputClass =
  'h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-60';

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
