import type { Metadata } from 'next';
import Link from 'next/link';
import { CaretRight, ClipboardText, FunnelSimple } from '@phosphor-icons/react/ssr';
import { EmptyState } from '@/components/dashboard/empty-state';
import { EstatusBadge } from '@/components/dashboard/estatus-badge';
import { PageHeader } from '@/components/dashboard/page-header';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { formatFechaHora, formatMoneda } from '@/lib/dashboard/format';
import {
  listarOrdenes,
  type EstatusOrden,
  ESTATUS_LABEL,
} from '@/lib/dashboard/queries/ordenes';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Órdenes · ExpressMX' };

const FILTROS: Array<{ key: 'todos' | EstatusOrden; label: string }> = [
  { key: 'todos', label: 'Todas' },
  { key: 'solicitada', label: 'Solicitadas' },
  { key: 'asignada', label: 'Asignadas' },
  { key: 'en_camino', label: 'En camino' },
  { key: 'en_progreso', label: 'En progreso' },
  { key: 'completada', label: 'Completadas' },
  { key: 'cancelada', label: 'Canceladas' },
];

interface SearchParams {
  estatus?: string;
  q?: string;
  page?: string;
}

const PAGE_SIZE = 50;

export default async function OrdenesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermiso('ordenes.ver');
  const sp = await searchParams;
  const estatusActivo = (sp.estatus ?? 'todos') as 'todos' | EstatusOrden;
  const q = sp.q?.trim() ?? '';
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const filter: Parameters<typeof listarOrdenes>[0] = {
    limit: PAGE_SIZE,
    offset,
  };
  if (estatusActivo !== 'todos') filter.estatus = estatusActivo;
  if (q) filter.q = q;
  const { rows, total } = await listarOrdenes(filter);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Órdenes"
        description={`${total.toLocaleString('es-MX')} órdenes en total`}
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
            placeholder="Buscar por cliente, servicio o ID"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>
        {estatusActivo !== 'todos' ? (
          <input type="hidden" name="estatus" value={estatusActivo} />
        ) : null}
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Buscar
        </button>
      </form>

      <nav className="mb-4 flex flex-wrap gap-1.5">
        {FILTROS.map((f) => {
          const active = estatusActivo === f.key;
          const params = new URLSearchParams();
          if (f.key !== 'todos') params.set('estatus', f.key);
          if (q) params.set('q', q);
          const href = `/dashboard/ordenes${params.toString() ? `?${params.toString()}` : ''}`;
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
          icon={ClipboardText}
          title="Sin órdenes"
          description={
            q || estatusActivo !== 'todos'
              ? 'Ningún resultado para tu filtro. Limpia los filtros para ver todas.'
              : 'Cuando los clientes soliciten servicios aparecerán aquí.'
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Orden</th>
                  <th className="px-4 py-2.5 text-left font-medium">Servicio</th>
                  <th className="px-4 py-2.5 text-left font-medium">Cliente</th>
                  <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">
                    Prestador
                  </th>
                  <th className="hidden px-4 py-2.5 text-left font-medium lg:table-cell">
                    Programada
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  <th className="px-4 py-2.5 text-left font-medium">Estatus</th>
                  <th className="w-10 px-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                      #{o.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 font-medium">{o.servicio}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.cliente}</td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {o.prestador ?? <span className="italic">Sin asignar</span>}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                      {formatFechaHora(o.fecha_programada)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">
                      {formatMoneda(o.monto_total)}
                    </td>
                    <td className="px-4 py-3">
                      <EstatusBadge estatus={o.estatus} />
                    </td>
                    <td className="px-2">
                      <Link
                        href={`/dashboard/ordenes/${o.id}`}
                        className="inline-flex items-center text-muted-foreground hover:text-foreground"
                        aria-label={`Ver orden ${o.id.slice(0, 8)}`}
                      >
                        <CaretRight size={16} aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <PaginationLink page={page - 1} estatus={estatusActivo} q={q}>
                    Anterior
                  </PaginationLink>
                ) : null}
                {page < totalPages ? (
                  <PaginationLink page={page + 1} estatus={estatusActivo} q={q}>
                    Siguiente
                  </PaginationLink>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}

      <p className="sr-only">
        Filtros disponibles: {FILTROS.map((f) => ESTATUS_LABEL[f.key as EstatusOrden] ?? f.label).join(', ')}
      </p>
    </>
  );
}

function PaginationLink({
  page,
  estatus,
  q,
  children,
}: {
  page: number;
  estatus: 'todos' | EstatusOrden;
  q: string;
  children: React.ReactNode;
}) {
  const params = new URLSearchParams();
  if (estatus !== 'todos') params.set('estatus', estatus);
  if (q) params.set('q', q);
  if (page > 1) params.set('page', String(page));
  const href = `/dashboard/ordenes${params.toString() ? `?${params.toString()}` : ''}`;
  return (
    <Link
      href={href}
      className="rounded-md border border-border bg-card px-3 py-1.5 font-medium text-foreground hover:bg-muted"
    >
      {children}
    </Link>
  );
}
