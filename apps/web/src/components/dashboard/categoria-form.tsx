'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FormattedNumberInput } from '@/components/dashboard/formatted-number-input';
import {
  actualizarCategoria,
  crearCategoria,
  eliminarCategoria,
  type CategoriaInput,
} from '@/lib/dashboard/actions/catalogo';

type Mode = 'create' | 'edit';

interface Props {
  mode: Mode;
  categoriaId?: string;
  initial?: CategoriaInput;
  serviciosCount?: number;
}

const EMPTY: CategoriaInput = {
  nombre: '',
  descripcion: '',
  orden_despliegue: 0,
  activa: true,
};

export function CategoriaForm({ mode, categoriaId, initial, serviciosCount }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<CategoriaInput>({ ...EMPTY, ...initial });
  const [pending, startTransition] = useTransition();

  function update<K extends keyof CategoriaInput>(key: K, value: CategoriaInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r =
        mode === 'create'
          ? await crearCategoria(form)
          : await actualizarCategoria(categoriaId!, form);
      if (r.ok) {
        toast.success(mode === 'create' ? 'Categoría creada' : 'Categoría guardada');
        if (mode === 'create' && 'id' in r && r.id) {
          router.push(`/dashboard/categorias/${r.id}`);
        } else {
          router.refresh();
        }
      } else {
        toast.error(r.message ?? 'No pudimos guardar');
      }
    });
  }

  function handleDelete() {
    if (!categoriaId) return;
    if (!confirm('¿Eliminar esta categoría? No se puede deshacer.')) return;
    startTransition(async () => {
      const r = await eliminarCategoria(categoriaId);
      if (r.ok) {
        toast.success('Categoría eliminada');
        router.push('/dashboard/categorias');
      } else {
        toast.error(r.message ?? 'No pudimos eliminar');
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
      </Field>

      <Field label="Descripción">
        <textarea
          value={form.descripcion ?? ''}
          onChange={(e) => update('descripcion', e.target.value)}
          rows={3}
          maxLength={280}
          className={`${inputClass} h-auto py-2`}
        />
      </Field>

      <Field label="Orden de despliegue">
        <FormattedNumberInput
          min={0}
          max={999}
          value={form.orden_despliegue}
          onValueChange={(value) => update('orden_despliegue', value ?? 0)}
          integer
          emptyWhenZero={mode === 'create'}
          className={inputClass}
        />
        <p className="text-xs text-muted-foreground">
          Las categorías con menor número aparecen primero en la app del cliente.
        </p>
      </Field>

      <label className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
        <input
          type="checkbox"
          checked={form.activa}
          onChange={(e) => update('activa', e.target.checked)}
          className="size-4 accent-primary"
        />
        <div>
          <span className="text-sm font-medium">Categoría activa</span>
          <p className="text-xs text-muted-foreground">
            Cuando está pausada, sus servicios no se muestran al cliente.
          </p>
        </div>
      </label>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {mode === 'edit' && serviciosCount === 0 ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="h-9 rounded-md border border-destructive/40 bg-destructive/5 px-3 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            Eliminar categoría
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? 'Guardando…' : mode === 'create' ? 'Crear categoría' : 'Guardar cambios'}
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
