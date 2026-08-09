'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FloppyDisk, Toolbox } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { actualizarServiciosPrestador } from '@/lib/dashboard/actions/prestadores';
import type { PrestadorServicioRow } from '@/lib/dashboard/queries/prestadores';
import { cn } from '@/lib/utils';

interface Props {
  prestadorId: string;
  servicios: ReadonlyArray<PrestadorServicioRow>;
  canEdit: boolean;
}

export function PrestadorServiciosForm({ prestadorId, servicios, canEdit }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(() =>
    servicios.filter((s) => s.habilitado).map((s) => s.id),
  );
  const [pending, startTransition] = useTransition();

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const grouped = useMemo(() => {
    const map = new Map<string, PrestadorServicioRow[]>();
    for (const servicio of servicios) {
      const group = map.get(servicio.categoria_nombre) ?? [];
      group.push(servicio);
      map.set(servicio.categoria_nombre, group);
    }
    return Array.from(map.entries());
  }, [servicios]);

  function toggle(servicioId: string, checked: boolean) {
    setSelected((prev) => {
      if (checked) return Array.from(new Set([...prev, servicioId]));
      return prev.filter((id) => id !== servicioId);
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    startTransition(async () => {
      const result = await actualizarServiciosPrestador(prestadorId, selected);
      if (result.ok) {
        toast.success('Capacidades actualizadas');
        router.refresh();
      } else {
        toast.error(result.message ?? 'No pudimos guardar las capacidades');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Capacidades operativas
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Servicios que puede cubrir este empleado.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          <Toolbox size={14} aria-hidden />
          {selected.length} activos
        </div>
      </div>

      {servicios.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay servicios activos en el catálogo.</p>
      ) : (
        <fieldset disabled={!canEdit || pending} className="space-y-5 disabled:opacity-70">
          {grouped.map(([categoria, items]) => (
            <div key={categoria} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {categoria}
              </h3>
              <div className="divide-y divide-border rounded-lg border border-border">
                {items.map((servicio) => {
                  const checked = selectedSet.has(servicio.id);
                  const disabled = !servicio.servicio_activo && !checked;
                  return (
                    <label
                      key={servicio.id}
                      className={cn(
                        'flex items-center justify-between gap-3 px-3 py-2.5 text-sm',
                        disabled ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{servicio.nombre}</span>
                        {!servicio.servicio_activo ? (
                          <span className="text-xs text-muted-foreground">Servicio inactivo</span>
                        ) : null}
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={(event) => toggle(servicio.id, event.target.checked)}
                        className="size-4 shrink-0 accent-primary"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </fieldset>
      )}

      {canEdit ? (
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={pending || servicios.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            <FloppyDisk size={16} aria-hidden />
            {pending ? 'Guardando...' : 'Guardar capacidades'}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Tu rol no permite cambiar capacidades del prestador.
        </p>
      )}
    </form>
  );
}