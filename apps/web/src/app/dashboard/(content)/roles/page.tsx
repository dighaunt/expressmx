import type { Metadata } from 'next';
import Link from 'next/link';
import { CaretRight, Plus, ShieldCheck, ShieldSlash } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { etiquetaDeRol } from '@/lib/dashboard/rbac';
import { formatNumero } from '@/lib/dashboard/format';
import { listarRoles } from '@/lib/dashboard/queries/roles';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Roles · ExpressMX' };

export default async function RolesPage() {
  await requirePermiso('roles.gestionar');
  const roles = await listarRoles();

  return (
    <>
      <PageHeader
        title="Roles y permisos"
        description={`${formatNumero(roles.length)} roles definidos`}
        actions={
          <Link
            href="/dashboard/roles/nuevo"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus size={16} aria-hidden /> Nuevo rol
          </Link>
        }
      />

      {roles.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Sin roles"
          description="Crea el primer rol para empezar a definir permisos."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {roles.map((r) => (
            <Link
              key={r.id}
              href={`/dashboard/roles/${r.id}`}
              className="group flex items-start gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-muted/30"
            >
              <span
                className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg ${r.activo ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}
              >
                {r.activo ? (
                  <ShieldCheck size={20} weight="duotone" aria-hidden />
                ) : (
                  <ShieldSlash size={20} weight="duotone" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">{etiquetaDeRol(r.nombre)}</h3>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {r.nombre}
                  </span>
                  {!r.activo ? <Badge variant="muted">Inactivo</Badge> : null}
                </div>
                {r.descripcion ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {r.descripcion}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>
                    <strong className="text-foreground">{formatNumero(r.count_permisos)}</strong>{' '}
                    {r.count_permisos === 1 ? 'permiso' : 'permisos'}
                  </span>
                  <span>
                    <strong className="text-foreground">
                      {formatNumero(r.count_admins_activos)}
                    </strong>{' '}
                    {r.count_admins_activos === 1 ? 'administrador' : 'administradores'}
                  </span>
                </div>
              </div>
              <CaretRight
                size={16}
                className="mt-1 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
