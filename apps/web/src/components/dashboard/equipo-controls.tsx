'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ShieldSlash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
  cambiarRolAdmin,
  desactivarAdmin,
  reactivarAdmin,
} from '@/lib/dashboard/actions/equipo';
import { etiquetaDeRol } from '@/lib/dashboard/rbac-shared';

interface Props {
  adminId: string;
  rolActualId: string;
  activo: boolean;
  roles: ReadonlyArray<{ id: string; nombre: string }>;
  esYoMismo: boolean;
}

export function EquipoControls({
  adminId,
  rolActualId,
  activo,
  roles,
  esYoMismo,
}: Props) {
  const router = useRouter();
  const [rolId, setRolId] = useState(rolActualId);
  const [pending, startTransition] = useTransition();

  function guardarRol() {
    if (rolId === rolActualId) {
      toast.info('Selecciona un rol distinto al actual');
      return;
    }
    startTransition(async () => {
      const r = await cambiarRolAdmin(adminId, rolId);
      if (r.ok) {
        toast.success('Rol actualizado');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos actualizar el rol');
      }
    });
  }

  function alternarAcceso() {
    if (esYoMismo && activo) {
      toast.error('No puedes desactivar tu propio acceso');
      return;
    }
    startTransition(async () => {
      const r = activo ? await desactivarAdmin(adminId) : await reactivarAdmin(adminId);
      if (r.ok) {
        toast.success(activo ? 'Acceso suspendido' : 'Acceso reactivado');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos actualizar');
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3">
          <p className="text-sm font-semibold">Cambiar rol</p>
          <p className="text-xs text-muted-foreground">
            Sustituye el rol asignado. Los permisos cambian al instante.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={rolId}
            onChange={(e) => setRolId(e.target.value)}
            className="h-10 flex-1 min-w-[200px] rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {etiquetaDeRol(r.nombre)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={guardarRol}
            disabled={pending || rolId === rolActualId}
            className="h-10 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {pending ? 'Guardando…' : 'Cambiar rol'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              {activo ? 'Suspender acceso' : 'Reactivar acceso'}
            </p>
            <p className="text-xs text-muted-foreground">
              {activo
                ? 'Bloquea el acceso al panel sin eliminar el registro.'
                : 'Devuelve el acceso al panel con el rol asignado.'}
            </p>
          </div>
          <button
            type="button"
            onClick={alternarAcceso}
            disabled={pending || (activo && esYoMismo)}
            className={
              activo
                ? 'inline-flex h-9 items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-60'
                : 'inline-flex h-9 items-center gap-1.5 rounded-md border border-success/40 bg-success/10 px-3 text-sm font-medium text-success transition-colors hover:bg-success/20 disabled:opacity-60'
            }
          >
            {activo ? (
              <ShieldSlash size={16} aria-hidden />
            ) : (
              <ShieldCheck size={16} aria-hidden />
            )}
            {pending ? 'Procesando…' : activo ? 'Suspender' : 'Reactivar'}
          </button>
        </div>
        {activo && esYoMismo ? (
          <p className="mt-2 text-xs text-muted-foreground">
            No puedes suspender tu propio acceso.
          </p>
        ) : null}
      </div>
    </div>
  );
}
