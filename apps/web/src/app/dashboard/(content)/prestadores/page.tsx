import type { Metadata } from 'next';
import Link from 'next/link';
import { CaretRight, FunnelSimple, Star, UsersThree } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { formatFechaCorta, formatNumero } from '@/lib/dashboard/format';
import {
  listarPrestadores,
  type PrestadoresFilter,
} from '@/lib/dashboard/queries/prestadores';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Prestadores · ExpressMX' };

const FILTROS: Array<{ key: NonNullable<PrestadoresFilter['estado']>; label: string }> = [
  { key: 'todos', label: 'Todos' },
  { key: 'en_turno', label: 'En turno' },
  { key: 'fuera_turno', label: 'Fuera de turno' },
  { key: 'restringidos', label: 'Restringidos' },
  { key: 'inactivos', label: 'Inactivos' },
];

interface SearchParams {
  estado?: string;
  q?: string;
  page?: string;
}

const PAGE_SIZE = 50;

export default async function PrestadoresPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requirePermiso('prestadores.ver');
  const sp = await searchParams;
  const estado = (sp.estado ?? 'todos') as NonNullable<PrestadoresFilter['estado']>;
  const q = sp.q?.trim() ?? '';
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const puedeInvitar = tienePermiso(viewer, 'prestadores.invitar');

  const filter: PrestadoresFilter = {
    estado,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };
  if (q) filter.q = q;

  const { rows, total } = await listarPrestadores(filter);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Prestadores"
        description={`${formatNumero(total)} cuentas de empleados`}
        actions={
          puedeInvitar ? (
            <Link
              href="/dashboard/invitaciones/nueva"
              className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Generar invitación
            </Link>
          ) : null
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <FunnelSimple
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre, email o teléfono"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>
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
          const href = `/dashboard/prestadores${params.toString() ? `?${params.toString()}` : ''}`;
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

      {rows.length === 0 ? (
        <EmptyState
          icon={UsersThree}
          title="Sin prestadores"
          description={
            q || estado !== 'todos'
              ? 'Ningún resultado para tu filtro.'
              : 'Genera una invitación de RRHH para registrar al primero.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Prestador</th>
                <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">
                  Contacto
                </th>
                <th className="px-4 py-2.5 text-right font-medium">Servicios</th>
                <th className="hidden px-4 py-2.5 text-right font-medium lg:table-cell">
                  Completadas
                </th>
                <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">
                  Rating
                </th>
                <th className="px-4 py-2.5 text-left font-medium">Estado</th>
                <th className="w-10 px-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {p.nombre} {p.apellidos}
                    </div>
                    <div className="text-xs text-muted-foreground md:hidden">{p.email}</div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    <div>{p.email}</div>
                    {p.telefono ? <div className="text-xs">{p.telefono}</div> : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {formatNumero(p.servicios_count)}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-right tabular-nums lg:table-cell">
                    {formatNumero(p.ordenes_completadas)}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-right md:table-cell">
                    {p.rating_promedio !== null ? (
                      <span className="inline-flex items-center gap-1">
                        <Star size={12} className="text-warning" weight="fill" aria-hidden />
                        <span className="tabular-nums">{p.rating_promedio.toFixed(1)}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.restringido ? (
                      <Badge variant="destructive">Restringido</Badge>
                    ) : !p.activo ? (
                      <Badge variant="muted">Inactivo</Badge>
                    ) : p.recibe_ordenes ? (
                      <Badge variant="success">En turno</Badge>
                    ) : (
                      <Badge variant="muted">Fuera</Badge>
                    )}
                  </td>
                  <td className="px-2">
                    <Link
                      href={`/dashboard/prestadores/${p.id}`}
                      className="inline-flex items-center text-muted-foreground hover:text-foreground"
                      aria-label={`Ver prestador ${p.nombre}`}
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

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <PaginationLink page={page - 1} estado={estado} q={q}>
                Anterior
              </PaginationLink>
            ) : null}
            {page < totalPages ? (
              <PaginationLink page={page + 1} estado={estado} q={q}>
                Siguiente
              </PaginationLink>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function PaginationLink({
  page,
  estado,
  q,
  children,
}: {
  page: number;
  estado: NonNullable<PrestadoresFilter['estado']>;
  q: string;
  children: React.ReactNode;
}) {
  const params = new URLSearchParams();
  if (estado !== 'todos') params.set('estado', estado);
  if (q) params.set('q', q);
  if (page > 1) params.set('page', String(page));
  const href = `/dashboard/prestadores${params.toString() ? `?${params.toString()}` : ''}`;
  return (
    <Link
      href={href}
      className="rounded-md border border-border bg-card px-3 py-1.5 font-medium text-foreground hover:bg-muted"
    >
      {children}
    </Link>
  );
}
