import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CaretRight,
  CurrencyCircleDollar,
  FunnelSimple,
} from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { MetricCard } from '@/components/dashboard/metric-card';
import { PageHeader } from '@/components/dashboard/page-header';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import {
  ESTATUS_PAGO_LABEL,
  METODO_PAGO_LABEL,
  type EstatusPago,
  type MetodoPago,
} from '@/lib/dashboard/finanzas-shared';
import { formatFechaHora, formatMoneda, formatNumero } from '@/lib/dashboard/format';
import { listarPagos, type PagosFilter } from '@/lib/dashboard/queries/pagos';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pagos · ExpressMX' };

const PAGE_SIZE = 50;

const ESTATUS_VARIANT: Record<EstatusPago, 'success' | 'warning' | 'destructive' | 'muted'> = {
  procesado: 'success',
  pendiente: 'warning',
  fallido: 'destructive',
  reembolsado: 'muted',
};

interface SearchParams {
  q?: string;
  estatus?: string;
  metodo?: string;
  desde?: string;
  hasta?: string;
  page?: string;
}

export default async function PagosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermiso('finanzas.ver');
  const sp = await searchParams;

  const q = sp.q?.trim() ?? '';
  const estatus = (sp.estatus ?? 'todos') as NonNullable<PagosFilter['estatus']>;
  const metodo = (sp.metodo ?? 'todos') as NonNullable<PagosFilter['metodo']>;
  const desde = sp.desde?.trim() ?? '';
  const hasta = sp.hasta?.trim() ?? '';
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const filter: PagosFilter = {
    estatus,
    metodo,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };
  if (q) filter.q = q;
  if (desde) filter.desde = desde;
  if (hasta) filter.hasta = hasta;

  const { rows, total, totales } = await listarPagos(filter);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Pagos"
        description={`${formatNumero(total)} pagos en el filtro actual`}
      />

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <MetricCard
          icon={CurrencyCircleDollar}
          label="Procesados"
          value={formatMoneda(totales.procesado, true)}
          accent="success"
        />
        <MetricCard
          icon={CurrencyCircleDollar}
          label="Pendientes"
          value={formatMoneda(totales.pendiente, true)}
          accent="warning"
        />
        <MetricCard
          icon={CurrencyCircleDollar}
          label="Reembolsados"
          value={formatMoneda(totales.reembolsado, true)}
          accent="neutral"
        />
      </section>

      <form
        method="get"
        className="mb-4 grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
      >
        <div className="relative lg:col-span-2">
          <FunnelSimple
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por orden, email o referencia"
            className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <select
          name="estatus"
          defaultValue={estatus}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
        >
          <option value="todos">Todos los estados</option>
          {(Object.keys(ESTATUS_PAGO_LABEL) as EstatusPago[]).map((s) => (
            <option key={s} value={s}>
              {ESTATUS_PAGO_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          name="metodo"
          defaultValue={metodo}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
        >
          <option value="todos">Todos los métodos</option>
          {(Object.keys(METODO_PAGO_LABEL) as MetodoPago[]).map((m) => (
            <option key={m} value={m}>
              {METODO_PAGO_LABEL[m]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Filtrar
        </button>

        <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Desde</span>
            <input
              type="date"
              name="desde"
              defaultValue={desde}
              className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Hasta</span>
            <input
              type="date"
              name="hasta"
              defaultValue={hasta}
              className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </label>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={CurrencyCircleDollar}
          title="Sin pagos"
          description={
            q || estatus !== 'todos' || metodo !== 'todos' || desde || hasta
              ? 'Ningún pago coincide con tu filtro.'
              : 'Cuando se cobre la primera orden aparecerá aquí.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Fecha</th>
                <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">Cliente</th>
                <th className="px-4 py-2.5 text-right font-medium">Monto</th>
                <th className="hidden px-4 py-2.5 text-left font-medium lg:table-cell">Método</th>
                <th className="px-4 py-2.5 text-left font-medium">Estado</th>
                <th className="w-10 px-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatFechaHora(p.created_at)}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="font-medium">{p.cliente_nombre ?? '—'}</div>
                    {p.cliente_email ? (
                      <div className="text-xs text-muted-foreground">{p.cliente_email}</div>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                    {formatMoneda(p.monto, true)}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    {METODO_PAGO_LABEL[p.metodo]}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={ESTATUS_VARIANT[p.estatus]}>
                      {ESTATUS_PAGO_LABEL[p.estatus]}
                    </Badge>
                  </td>
                  <td className="px-2">
                    <Link
                      href={`/dashboard/pagos/${p.id}`}
                      className="inline-flex items-center text-muted-foreground hover:text-foreground"
                      aria-label="Ver detalle del pago"
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
              <PageLink page={page - 1} sp={sp}>
                Anterior
              </PageLink>
            ) : null}
            {page < totalPages ? (
              <PageLink page={page + 1} sp={sp}>
                Siguiente
              </PageLink>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function PageLink({
  page,
  sp,
  children,
}: {
  page: number;
  sp: SearchParams;
  children: React.ReactNode;
}) {
  const params = new URLSearchParams();
  if (sp.q) params.set('q', sp.q);
  if (sp.estatus && sp.estatus !== 'todos') params.set('estatus', sp.estatus);
  if (sp.metodo && sp.metodo !== 'todos') params.set('metodo', sp.metodo);
  if (sp.desde) params.set('desde', sp.desde);
  if (sp.hasta) params.set('hasta', sp.hasta);
  if (page > 1) params.set('page', String(page));
  const href = `/dashboard/pagos${params.toString() ? `?${params.toString()}` : ''}`;
  return (
    <Link
      href={href}
      className={cn(
        'rounded-md border border-border bg-card px-3 py-1.5 font-medium text-foreground hover:bg-muted',
      )}
    >
      {children}
    </Link>
  );
}
