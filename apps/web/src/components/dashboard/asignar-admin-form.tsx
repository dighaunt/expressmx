'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, MagnifyingGlass, UserCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { asignarAdmin, buscarUsuarios } from '@/lib/dashboard/actions/equipo';
import { etiquetaDeRol } from '@/lib/dashboard/rbac-shared';
import type { UsuarioBuscado } from '@/lib/dashboard/queries/equipo';
import { cn } from '@/lib/utils';

interface Props {
  roles: ReadonlyArray<{ id: string; nombre: string }>;
}

export function AsignarAdminForm({ roles }: Props) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<UsuarioBuscado[]>([]);
  const [seleccionado, setSeleccionado] = useState<UsuarioBuscado | null>(null);
  const [rolId, setRolId] = useState(roles[0]?.id ?? '');
  const [buscando, startBuscar] = useTransition();
  const [guardando, startGuardar] = useTransition();

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) {
      toast.error('Ingresa al menos 2 caracteres');
      return;
    }
    startBuscar(async () => {
      const rows = await buscarUsuarios(q);
      setResultados(rows);
      if (rows.length === 0) toast.info('No encontramos usuarios con ese término');
    });
  }

  function handleAsignar() {
    if (!seleccionado || !rolId) return;
    startGuardar(async () => {
      const r = await asignarAdmin(seleccionado.id, rolId);
      if (r.ok && r.adminId) {
        toast.success('Acceso asignado');
        router.push(`/dashboard/equipo/${r.adminId}`);
      } else {
        toast.error(r.message ?? 'No pudimos asignar el acceso');
      }
    });
  }

  if (seleccionado) {
    return (
      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <Avatar nombre={seleccionado.nombre} src={seleccionado.avatar_url} />
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {seleccionado.nombre} {seleccionado.apellidos}
            </p>
            <p className="text-sm text-muted-foreground">{seleccionado.email}</p>
            {seleccionado.ya_es_admin ? (
              <p className="mt-1 text-xs text-warning-foreground">
                {seleccionado.admin_activo
                  ? 'Ya tiene acceso administrativo. Si continúas se le cambiará el rol.'
                  : 'Ya tuvo acceso administrativo. Si continúas se reactivará con el rol seleccionado.'}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setSeleccionado(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cambiar
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Rol</label>
          <select
            value={rolId}
            onChange={(e) => setRolId(e.target.value)}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {etiquetaDeRol(r.nombre)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Después podrás cambiar el rol o desactivar el acceso desde el detalle.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setSeleccionado(null)}
            className="h-10 rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleAsignar}
            disabled={guardando || !rolId}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            <Check size={16} aria-hidden />
            {guardando ? 'Asignando…' : 'Asignar acceso'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleBuscar}
        className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-4"
      >
        <div className="relative flex-1 min-w-[220px]">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar usuario por email o nombre"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={buscando || q.trim().length < 2}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {buscando ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {resultados.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {resultados.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => setSeleccionado(u)}
                className={cn(
                  'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40',
                )}
              >
                <Avatar nombre={u.nombre} src={u.avatar_url} />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {u.nombre} {u.apellidos}
                  </p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                {u.ya_es_admin ? (
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                      u.admin_activo
                        ? 'bg-success/10 text-success'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {u.admin_activo ? 'Ya es admin' : 'Suspendido'}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Avatar({ nombre, src }: { nombre: string; src: string | null }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="size-10 shrink-0 rounded-full object-cover ring-1 ring-border"
      />
    );
  }
  return (
    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <UserCircle size={22} weight="duotone" aria-hidden />
      <span className="sr-only">{nombre}</span>
    </span>
  );
}
