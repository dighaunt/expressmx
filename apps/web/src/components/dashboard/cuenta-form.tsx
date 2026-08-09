'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { actualizarPerfil, type PerfilInput } from '@/lib/dashboard/actions/cuenta';

interface Props {
  initial: { nombre: string; apellidos: string; telefono: string; avatar_url: string };
  email: string;
}

export function CuentaForm({ initial, email }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [pending, startTransition] = useTransition();

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: PerfilInput = {
      nombre: form.nombre,
      apellidos: form.apellidos,
      telefono: form.telefono.trim() || null,
      avatar_url: form.avatar_url.trim() || null,
    };
    startTransition(async () => {
      const r = await actualizarPerfil(payload);
      if (r.ok) {
        toast.success('Perfil actualizado');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos guardar');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
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
        <Field label="Apellidos" required>
          <input
            type="text"
            value={form.apellidos}
            onChange={(e) => update('apellidos', e.target.value)}
            maxLength={80}
            required
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Email">
        <input
          type="email"
          value={email}
          disabled
          className={`${inputClass} cursor-not-allowed bg-muted text-muted-foreground`}
        />
        <p className="text-xs text-muted-foreground">
          El email es el identificador de la cuenta y no puede cambiarse desde aquí.
        </p>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Teléfono">
          <input
            type="tel"
            value={form.telefono}
            onChange={(e) => update('telefono', e.target.value)}
            maxLength={20}
            placeholder="+52 55 1234 5678"
            className={inputClass}
          />
        </Field>
        <Field label="URL del avatar">
          <input
            type="url"
            value={form.avatar_url}
            onChange={(e) => update('avatar_url', e.target.value)}
            placeholder="https://…"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? 'Guardando…' : 'Guardar cambios'}
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
