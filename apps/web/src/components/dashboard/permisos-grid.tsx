'use client';

import { useOptimistic, useTransition } from 'react';
import { toast } from 'sonner';
import { togglePermiso } from '@/lib/dashboard/actions/roles';
import type { PermisosPorModulo } from '@/lib/dashboard/queries/roles';
import { cn } from '@/lib/utils';

const MODULO_ETIQUETA: Record<string, string> = {
  catalogo: 'Catálogo',
  configuracion: 'Configuración',
  finanzas: 'Finanzas',
  operaciones: 'Operaciones',
  ordenes: 'Órdenes',
  prestadores: 'Prestadores',
  reportes: 'Reportes',
  sistema: 'Sistema',
  soporte: 'Soporte',
  usuarios: 'Usuarios',
};

interface Props {
  rolId: string;
  modulos: PermisosPorModulo[];
  asignados: string[];
  deshabilitado: boolean;
}

export function PermisosGrid({ rolId, modulos, asignados, deshabilitado }: Props) {
  const [pending, startTransition] = useTransition();
  const [estado, aplicarOptimista] = useOptimistic<Set<string>, { clave: string; on: boolean }>(
    new Set(asignados),
    (prev, action) => {
      const next = new Set(prev);
      if (action.on) next.add(action.clave);
      else next.delete(action.clave);
      return next;
    },
  );

  function handleToggle(clave: string, on: boolean) {
    if (deshabilitado) return;
    startTransition(async () => {
      aplicarOptimista({ clave, on });
      const r = await togglePermiso(rolId, clave, on);
      if (!r.ok) {
        aplicarOptimista({ clave, on: !on });
        toast.error(r.message ?? 'No pudimos actualizar el permiso');
      }
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {modulos.map((m) => (
        <fieldset
          key={m.modulo}
          className="rounded-lg border border-border bg-background p-3"
        >
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {MODULO_ETIQUETA[m.modulo] ?? m.modulo}
          </legend>
          <ul className="space-y-1.5">
            {m.permisos.map((p) => {
              const checked = estado.has(p.clave);
              return (
                <li key={p.id}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-md p-2 transition-colors',
                      'hover:bg-muted/50',
                      deshabilitado && 'cursor-not-allowed opacity-60',
                      pending && 'pointer-events-none',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 accent-primary"
                      checked={checked || deshabilitado}
                      disabled={deshabilitado}
                      onChange={(e) => handleToggle(p.clave, e.target.checked)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs text-foreground">{p.clave}</div>
                      {p.descripcion ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{p.descripcion}</p>
                      ) : null}
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
    </div>
  );
}
