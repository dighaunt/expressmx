'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FormattedNumberInput } from '@/components/dashboard/formatted-number-input';
import {
  actualizarBanner,
  crearBanner,
  eliminarBanner,
  type BannerInput,
} from '@/lib/dashboard/actions/banners';

interface Props {
  mode: 'create' | 'edit';
  bannerId?: string;
  initial?: BannerInput;
}

const TODAY = new Date().toISOString().slice(0, 10);

const EMPTY: BannerInput = {
  titulo: '',
  imagen_url: '',
  url_destino: null,
  fecha_inicio: TODAY,
  fecha_fin: TODAY,
  orden_prioridad: 0,
  segmento: 'todos',
  activo: true,
};

const DESTINOS_RAPIDOS = [
  { label: 'Servicios', value: '/services' },
  { label: 'Pedidos', value: '/orders' },
  { label: 'Billetera', value: '/wallet' },
  { label: 'Perfil', value: '/profile' },
];

export function BannerForm({ mode, bannerId, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<BannerInput>({ ...EMPTY, ...initial });
  const [pending, startTransition] = useTransition();

  function update<K extends keyof BannerInput>(key: K, value: BannerInput[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r =
        mode === 'create' ? await crearBanner(form) : await actualizarBanner(bannerId!, form);
      if (r.ok) {
        toast.success(mode === 'create' ? 'Banner creado' : 'Banner actualizado');
        if (mode === 'create' && r.id) router.push(`/dashboard/banners/${r.id}`);
        else router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos guardar');
      }
    });
  }

  function handleDelete() {
    if (!bannerId) return;
    if (!confirm('¿Eliminar este banner? No se puede deshacer.')) return;
    startTransition(async () => {
      const r = await eliminarBanner(bannerId);
      if (r.ok) {
        toast.success('Banner eliminado');
        router.push('/dashboard/banners');
      } else {
        toast.error(r.message ?? 'No pudimos eliminar');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-border bg-card p-6">
      <Field label="Título" required>
        <input
          type="text"
          value={form.titulo}
          onChange={(e) => update('titulo', e.target.value)}
          maxLength={120}
          required
          className={inputClass}
        />
      </Field>

      <Field label="URL de la imagen" required>
        <input
          type="url"
          value={form.imagen_url}
          onChange={(e) => update('imagen_url', e.target.value)}
          placeholder="https://cdn.expressmx.com/banners/promo.jpg"
          required
          className={inputClass}
        />
        {form.imagen_url ? (
          <div className="mt-2 overflow-hidden rounded-lg border border-border bg-muted">
            <img
              src={form.imagen_url}
              alt=""
              className="aspect-[16/9] w-full max-w-md object-cover"
            />
          </div>
        ) : null}
      </Field>

      <Field label="Destino al tocar">
        <input
          type="text"
          inputMode="url"
          value={form.url_destino ?? ''}
          onChange={(e) => update('url_destino', e.target.value || null)}
          placeholder="/services, expressmx://services o https://expressmx.com/promo"
          className={inputClass}
        />
        <div className="flex flex-wrap gap-2">
          {DESTINOS_RAPIDOS.map((destino) => (
            <button
              key={destino.value}
              type="button"
              onClick={() => update('url_destino', destino.value)}
              className="h-8 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted"
            >
              {destino.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Si lo omites, la app cliente enviará al usuario a Servicios.
        </p>
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Vigencia desde" required>
          <input
            type="date"
            value={form.fecha_inicio}
            onChange={(e) => update('fecha_inicio', e.target.value)}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Vigencia hasta" required>
          <input
            type="date"
            value={form.fecha_fin}
            onChange={(e) => update('fecha_fin', e.target.value)}
            required
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Segmento">
          <select
            value={form.segmento}
            onChange={(e) => update('segmento', e.target.value as BannerInput['segmento'])}
            className={inputClass}
          >
            <option value="todos">Todos los clientes</option>
            <option value="nuevos">Nuevos clientes</option>
            <option value="recurrentes">Clientes recurrentes</option>
          </select>
        </Field>
        <Field label="Prioridad">
          <FormattedNumberInput
            min={0}
            max={999}
            value={form.orden_prioridad}
            onValueChange={(value) => update('orden_prioridad', value ?? 0)}
            integer
            emptyWhenZero={mode === 'create'}
            className={inputClass}
          />
          <p className="text-xs text-muted-foreground">
            Menor número aparece primero.
          </p>
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
          <span className="text-sm font-medium">Banner activo</span>
          <p className="text-xs text-muted-foreground">
            Si está pausado no se muestra aunque esté dentro de la vigencia.
          </p>
        </div>
      </label>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {mode === 'edit' ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="h-9 rounded-md border border-destructive/40 bg-destructive/5 px-3 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
          >
            Eliminar banner
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? 'Guardando…' : mode === 'create' ? 'Crear banner' : 'Guardar cambios'}
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
