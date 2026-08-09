'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { FormattedNumberInput } from '@/components/dashboard/formatted-number-input';
import { crearTarifa, type TarifaInput } from '@/lib/dashboard/actions/zonas';

interface ServicioOption {
  id: string;
  nombre: string;
  categoria_nombre: string;
}

interface Props {
  zonaId: string;
  servicios: ReadonlyArray<ServicioOption>;
}

const TODAY = new Date().toISOString().slice(0, 10);

export function TarifaForm({ zonaId, servicios }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TarifaInput>({
    servicio_id: servicios[0]?.id ?? '',
    tipo_ajuste: 'multiplicador',
    valor: 1.2,
    vigencia_inicio: TODAY,
    vigencia_fin: null,
    activa: true,
  });
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await crearTarifa(zonaId, form);
      if (r.ok) {
        toast.success('Tarifa agregada');
        setOpen(false);
        setForm((p) => ({ ...p, valor: p.tipo_ajuste === 'multiplicador' ? 1.2 : 50 }));
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos agregar la tarifa');
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed border-border bg-card px-3 text-sm font-medium hover:bg-muted"
      >
        <Plus size={14} aria-hidden />
        Agregar tarifa
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2"
    >
      <div className="sm:col-span-2 space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Servicio
        </label>
        <select
          value={form.servicio_id}
          onChange={(e) => setForm((p) => ({ ...p, servicio_id: e.target.value }))}
          required
          className={inputClass}
        >
          <option value="">Selecciona un servicio</option>
          {servicios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.categoria_nombre} · {s.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tipo de ajuste
        </label>
        <select
          value={form.tipo_ajuste}
          onChange={(e) =>
            setForm((p) => ({
              ...p,
              tipo_ajuste: e.target.value as TarifaInput['tipo_ajuste'],
              valor: e.target.value === 'multiplicador' ? 1.2 : 50,
            }))
          }
          className={inputClass}
        >
          <option value="multiplicador">Multiplicador (1.2 = +20%)</option>
          <option value="monto_fijo">Monto fijo en MXN</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Valor
        </label>
        <FormattedNumberInput
          key={form.tipo_ajuste}
          min={form.tipo_ajuste === 'multiplicador' ? 0.1 : 1}
          max={form.tipo_ajuste === 'multiplicador' ? 10 : 99999}
          value={form.valor}
          onValueChange={(value) => setForm((p) => ({ ...p, valor: value ?? 0 }))}
          maximumFractionDigits={2}
          emptyWhenZero
          required
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Vigencia desde
        </label>
        <input
          type="date"
          value={form.vigencia_inicio}
          onChange={(e) => setForm((p) => ({ ...p, vigencia_inicio: e.target.value }))}
          required
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Vigencia hasta (opcional)
        </label>
        <input
          type="date"
          value={form.vigencia_fin ?? ''}
          onChange={(e) =>
            setForm((p) => ({ ...p, vigencia_fin: e.target.value || null }))
          }
          className={inputClass}
        />
      </div>

      <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending || !form.servicio_id}
          className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? 'Guardando…' : 'Guardar tarifa'}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  'h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20';
