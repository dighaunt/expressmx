'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  actualizarRol,
  crearRol,
  eliminarRol,
  type RolInput,
} from '@/lib/dashboard/actions/roles';

type Mode = 'create' | 'edit';

interface Props {
  mode: Mode;
  rolId?: string;
  initial?: { nombre: string; descripcion: string | null; activo: boolean };
  adminsAsignados?: number;
  protegido?: boolean;
}

const EMPTY: RolInput = { nombre: '', descripcion: '', activo: true };

export function RolForm({
  mode,
  rolId,
  initial,
  adminsAsignados = 0,
  protegido = false,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<RolInput>({
    ...EMPTY,
    ...(initial && {
      nombre: initial.nombre,
      descripcion: initial.descripcion ?? '',
      activo: initial.activo,
    }),
  });
  const [pending, startTransition] = useTransition();

  function update<K extends keyof RolInput>(key: K, value: RolInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r =
        mode === 'create'
          ? await crearRol(form)
          : await actualizarRol(rolId!, form);
      if (r.ok) {
        toast.success(mode === 'create' ? 'Rol creado' : 'Rol guardado');
        if (mode === 'create' && 'id' in r && r.id) {
          router.push(`/dashboard/roles/${r.id}`);
        } else {
          router.refresh();
        }
      } else {
        toast.error(r.message ?? 'No pudimos guardar');
      }
    });
  }

  function handleDelete() {
    if (!rolId) return;
    if (!confirm('¿Eliminar este rol? No se puede deshacer.')) return;
    startTransition(async () => {
      const r = await eliminarRol(rolId);
      if (r.ok) {
        toast.success('Rol eliminado');
        router.push('/dashboard/roles');
      } else {
        toast.error(r.message ?? 'No pudimos eliminar');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Identificador" required>
        <input
          type="text"
          value={form.nombre}
          onChange={(e) =>
            update('nombre', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
          }
          maxLength={31}
          placeholder="gerente_zona_sur"
          required
          disabled={mode === 'edit' && protegido}
          className={inputClass}
        />
        <p className="text-xs text-muted-foreground">
          Solo minúsculas, números y guion bajo. Es la clave usada en código.
        </p>
      </Field>

      <Field label="Descripción">
        <textarea
          value={form.descripcion ?? ''}
          onChange={(e) => update('descripcion', e.target.value)}
          rows={2}
          maxLength={240}
          placeholder="Para quién es este rol y qué responsabilidades tiene."
          className={`${inputClass} h-auto py-2`}
        />
      </Field>

      <label className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
        <input
          type="checkbox"
          checked={form.activo}
          onChange={(e) => update('activo', e.target.checked)}
          disabled={protegido}
          className="size-4 accent-primary"
        />
        <div>
          <span className="text-sm font-medium">Rol activo</span>
          <p className="text-xs text-muted-foreground">
            Cuando está pausado, los administradores asignados pierden acceso.
          </p>
        </div>
      </label>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {mode === 'edit' && !protegido && adminsAsignados === 0 ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="h-9 rounded-md border border-destructive/40 bg-destructive/5 px-3 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            Eliminar rol
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? 'Guardando…' : mode === 'create' ? 'Crear rol' : 'Guardar cambios'}
        </button>
      </div>

      {mode === 'edit' && adminsAsignados > 0 ? (
        <p className="text-xs text-muted-foreground">
          {adminsAsignados} administrador{adminsAsignados === 1 ? '' : 'es'} asignado
          {adminsAsignados === 1 ? '' : 's'}. Para eliminar el rol primero quítalo del equipo.
        </p>
      ) : null}
    </form>
  );
}

const inputClass =
  'h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60';

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
