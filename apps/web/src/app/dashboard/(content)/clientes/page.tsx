import type { Metadata } from 'next';
import Link from 'next/link';
import { CaretRight, FunnelSimple, UserCircle } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { formatFechaCorta, formatNumero } from '@/lib/dashboard/format';
import { listarClientes, type ClientesFilter } from '@/lib/dashboard/queries/clientes';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Clientes · ExpressMX' };

const FILTROS: Array<{ key: NonNullable<ClientesFilter['estado']>; label: string }> = [
  { key: 'todos', label: 'Todos' },
  { key: 'activos', label: 'Activos' },
  { key: 'restringidos', label: 'Restringidos' },
  { key: 'inactivos', label: 'Inactivos' },
];

interface SearchParams {
  estado?: string;
  q?: string;
  page?: string;
}

const PAGE_SIZE = 50;

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermiso('usuarios.listar_completo');
  const sp = await searchParams;
  const estado = (sp.estado ?? 'todos') as NonNullable<ClientesFilter['estado']>;
  const q = sp.q?.trim() ?? '';
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const filter: ClientesFilter = {
    estado,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };
  if (q) filter.q = q;

  const { rows, total } = await listarClientes(filter);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Clientes"
        description={`${formatNumero(total)} cuentas registradas`}
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
          const href = `/dashboard/clientes${params.toString() ? `?${params.toString()}` : ''}`;
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
          icon={UserCircle}
          title="Sin clientes"
          description={
            q || estado !== 'todos'
              ? 'Ningún resultado para tu filtro.'
              : 'Cuando los clientes se registren aparecerán aquí.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Cliente</th>
                <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">
                  Contacto
                </th>
                <th className="px-4 py-2.5 text-right font-medium">Órdenes</th>
                <th className="hidden px-4 py-2.5 text-left font-medium lg:table-cell">
                  Alta
                </th>
                <th className="px-4 py-2.5 text-left font-medium">Estado</th>
                <th className="w-10 px-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {c.nombre} {c.apellidos}
                    </div>
                    <div className="text-xs text-muted-foreground md:hidden">{c.email}</div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    <div>{c.email}</div>
                    {c.telefono ? <div className="text-xs">{c.telefono}</div> : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {formatNumero(c.ordenes_total)}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {formatFechaCorta(c.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {c.restringido ? (
                      <Badge variant="destructive">Restringido</Badge>
                    ) : c.activo ? (
                      <Badge variant="success">Activo</Badge>
                    ) : (
                      <Badge variant="muted">Inactivo</Badge>
                    )}
                  </td>
                  <td className="px-2">
                    <Link
                      href={`/dashboard/clientes/${c.id}`}
                      className="inline-flex items-center text-muted-foreground hover:text-foreground"
                      aria-label={`Ver cliente ${c.nombre}`}
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
  estado: NonNullable<ClientesFilter['estado']>;
  q: string;
  children: React.ReactNode;
}) {
  const params = new URLSearchParams();
  if (estado !== 'todos') params.set('estado', estado);
  if (q) params.set('q', q);
  if (page > 1) params.set('page', String(page));
  const href = `/dashboard/clientes${params.toString() ? `?${params.toString()}` : ''}`;
  return (
    <Link
      href={href}
      className="rounded-md border border-border bg-card px-3 py-1.5 font-medium text-foreground hover:bg-muted"
    >
      {children}
    </Link>
  );
}
