import type { Metadata } from 'next';
import Link from 'next/link';
import { CaretRight, FunnelSimple, Plus, UsersThree } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { etiquetaDeRol } from '@/lib/dashboard/rbac';
import { formatFechaCorta, formatFechaHora, formatNumero } from '@/lib/dashboard/format';
import { listarAdmins, rolesActivos, type AdminFilter } from '@/lib/dashboard/queries/equipo';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Equipo · ExpressMX' };

const FILTROS: Array<{ key: NonNullable<AdminFilter['estado']>; label: string }> = [
  { key: 'todos', label: 'Todos' },
  { key: 'activos', label: 'Activos' },
  { key: 'inactivos', label: 'Inactivos' },
];

interface SearchParams {
  q?: string;
  estado?: string;
  rol?: string;
}

export default async function EquipoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermiso('roles.gestionar');
  const sp = await searchParams;

  const estado = (sp.estado ?? 'todos') as NonNullable<AdminFilter['estado']>;
  const q = sp.q?.trim() ?? '';
  const rolId = sp.rol?.trim() ?? '';

  const filter: AdminFilter = { estado };
  if (q) filter.q = q;
  if (rolId) filter.rolId = rolId;

  const [admins, roles] = await Promise.all([listarAdmins(filter), rolesActivos()]);

  return (
    <>
      <PageHeader
        title="Equipo administrativo"
        description={`${formatNumero(admins.length)} accesos`}
        actions={
          <Link
            href="/dashboard/equipo/nuevo"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus size={16} aria-hidden /> Asignar acceso
          </Link>
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-full sm:basis-[220px]">
          <FunnelSimple
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre o email"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <select
          name="rol"
          defaultValue={rolId}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
        >
          <option value="">Todos los roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {etiquetaDeRol(r.nombre)}
            </option>
          ))}
        </select>
        {estado !== 'todos' ? <input type="hidden" name="estado" value={estado} /> : null}
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Buscar
        </button>
      </form>

      <nav className="mb-4 flex flex-wrap gap-1.5">
        {FILTROS.map((f) => {
          const active = estado === f.key;
          const params = new URLSearchParams();
          if (f.key !== 'todos') params.set('estado', f.key);
          if (q) params.set('q', q);
          if (rolId) params.set('rol', rolId);
          const href = `/dashboard/equipo${params.toString() ? `?${params.toString()}` : ''}`;
          return (
            <Link
              key={f.key}
              href={href}
              className={cn(
                'inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:bg-muted',
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {admins.length === 0 ? (
        <EmptyState
          icon={UsersThree}
          title="Sin administradores"
          description={
            q || estado !== 'todos' || rolId
              ? 'Ningún resultado para tu filtro.'
              : 'Asigna acceso a un usuario para empezar.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Persona</th>
                <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">Rol</th>
                <th className="hidden px-4 py-2.5 text-left font-medium lg:table-cell">
                  Último acceso
                </th>
                <th className="hidden px-4 py-2.5 text-left font-medium lg:table-cell">Alta</th>
                <th className="px-4 py-2.5 text-left font-medium">Estado</th>
                <th className="w-10 px-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {admins.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {a.nombre} {a.apellidos}
                    </div>
                    <div className="text-xs text-muted-foreground">{a.email}</div>
                    <div className="mt-1 text-xs md:hidden">
                      <span className="font-medium">{etiquetaDeRol(a.rol_nombre)}</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="font-medium">{etiquetaDeRol(a.rol_nombre)}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {a.rol_nombre}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {a.ultimo_acceso ? formatFechaHora(a.ultimo_acceso) : 'Nunca'}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {formatFechaCorta(a.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {a.activo ? (
                      <Badge variant="success">Activo</Badge>
                    ) : (
                      <Badge variant="muted">Suspendido</Badge>
                    )}
                  </td>
                  <td className="px-2">
                    <Link
                      href={`/dashboard/equipo/${a.id}`}
                      className="inline-flex items-center text-muted-foreground hover:text-foreground"
                      aria-label={`Editar acceso de ${a.nombre}`}
                    >
                      <CaretRight size={16} aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
