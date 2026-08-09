'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FormattedNumberInput } from '@/components/dashboard/formatted-number-input';
import {
  actualizarCupon,
  crearCupon,
  detenerCupon,
  type CuponInput,
} from '@/lib/dashboard/actions/cupones';

interface CategoriaOption {
  id: string;
  nombre: string;
}

interface Props {
  mode: 'create' | 'edit';
  cuponId?: string;
  initial?: CuponInput;
  categorias: ReadonlyArray<CategoriaOption>;
  usosActuales?: number;
  estado?: 'activo' | 'agotado' | 'expirado' | 'futuro';
}

const TODAY = new Date().toISOString().slice(0, 10);

const EMPTY: CuponInput = {
  codigo: '',
  tipo_descuento: 'porcentaje',
  valor: 10,
  fecha_inicio: TODAY,
  fecha_expiracion: TODAY,
  usos_maximos: 100,
  solo_primera_compra: false,
  categoria_id: null,
};

export function CuponForm({
  mode,
  cuponId,
  initial,
  categorias,
  usosActuales = 0,
  estado,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<CuponInput>({ ...EMPTY, ...initial });
  const [pending, startTransition] = useTransition();

  function update<K extends keyof CuponInput>(key: K, value: CuponInput[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r =
        mode === 'create' ? await crearCupon(form) : await actualizarCupon(cuponId!, form);
      if (r.ok) {
        toast.success(mode === 'create' ? 'Cupón creado' : 'Cupón actualizado');
        if (mode === 'create' && r.id) router.push(`/dashboard/cupones/${r.id}`);
        else router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos guardar');
      }
    });
  }

  function handleStop() {
    if (!cuponId) return;
    if (!confirm('¿Detener este cupón? Ya no podrá redimirse, pero los usos previos se mantienen.')) {
      return;
    }
    startTransition(async () => {
      const r = await detenerCupon(cuponId);
      if (r.ok) toast.success('Cupón detenido');
      else toast.error(r.message ?? 'No pudimos detenerlo');
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-border bg-card p-6">
      <Field label="Código" required>
        <input
          type="text"
          value={form.codigo}
          onChange={(e) => update('codigo', e.target.value.toUpperCase())}
          maxLength={32}
          placeholder="VERANO10"
          required
          className={`${inputClass} uppercase tracking-wider font-mono`}
        />
        <p className="text-xs text-muted-foreground">
          Solo letras, números, guion y guion bajo. Se guarda en mayúsculas.
        </p>
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Tipo de descuento">
          <select
            value={form.tipo_descuento}
            onChange={(e) =>
              update('tipo_descuento', e.target.value as CuponInput['tipo_descuento'])
            }
            className={inputClass}
          >
            <option value="porcentaje">Porcentaje</option>
            <option value="monto_fijo">Monto fijo (MXN)</option>
          </select>
        </Field>
        <Field
          label={form.tipo_descuento === 'porcentaje' ? 'Porcentaje (1-100)' : 'Monto (MXN)'}
          required
        >
          <FormattedNumberInput
            key={form.tipo_descuento}
            min={1}
            max={form.tipo_descuento === 'porcentaje' ? 100 : 99999}
            value={form.valor}
            onValueChange={(value) => update('valor', value ?? 0)}
            integer={form.tipo_descuento === 'porcentaje'}
            maximumFractionDigits={form.tipo_descuento === 'porcentaje' ? 0 : 2}
            emptyWhenZero
            required
            className={inputClass}
          />
        </Field>
      </div>

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
        <Field label="Expira el" required>
          <input
            type="date"
            value={form.fecha_expiracion}
            onChange={(e) => update('fecha_expiracion', e.target.value)}
            required
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Usos máximos" required>
        <FormattedNumberInput
          min={Math.max(usosActuales, 1)}
          max={100000}
          value={form.usos_maximos}
          onValueChange={(value) => update('usos_maximos', value ?? 0)}
          integer
          emptyWhenZero
          required
          className={inputClass}
        />
        {mode === 'edit' ? (
          <p className="text-xs text-muted-foreground">
            Usos actuales: {usosActuales}. No puedes bajar el máximo por debajo de este número.
          </p>
        ) : null}
      </Field>

      <Field label="Categoría aplicable">
        <select
          value={form.categoria_id ?? ''}
          onChange={(e) => update('categoria_id', e.target.value || null)}
          className={inputClass}
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </Field>

      <label className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
        <input
          type="checkbox"
          checked={form.solo_primera_compra}
          onChange={(e) => update('solo_primera_compra', e.target.checked)}
          className="size-4 accent-primary"
        />
        <div>
          <span className="text-sm font-medium">Solo primera compra</span>
          <p className="text-xs text-muted-foreground">
            El cupón solo aplica si el cliente nunca ha pagado en ExpressMX.
          </p>
        </div>
      </label>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {mode === 'edit' && estado === 'activo' ? (
          <button
            type="button"
            onClick={handleStop}
            disabled={pending}
            className="h-9 rounded-md border border-destructive/40 bg-destructive/5 px-3 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
          >
            Detener cupón
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? 'Guardando…' : mode === 'create' ? 'Crear cupón' : 'Guardar cambios'}
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
