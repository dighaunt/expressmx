import type { Metadata } from 'next';
import Link from 'next/link';
import { CaretRight, ChartLine } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { formatFechaCorta, formatMoneda, formatNumero } from '@/lib/dashboard/format';
import {
  ESTATUS_REEMBOLSO_LABEL,
  listarReembolsos,
  type EstatusReembolso,
} from '@/lib/dashboard/queries/reembolsos';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Reembolsos · ExpressMX' };

const FILTROS: Array<{ key: 'todos' | EstatusReembolso; label: string }> = [
  { key: 'todos', label: 'Todos' },
  { key: 'solicitado', label: 'Solicitados' },
  { key: 'aprobado', label: 'Aprobados' },
  { key: 'procesado', label: 'Procesados' },
  { key: 'rechazado', label: 'Rechazados' },
];

const VARIANT_BY_ESTATUS: Record<
  EstatusReembolso,
  'warning' | 'info' | 'success' | 'destructive'
> = {
  solicitado: 'warning',
  aprobado: 'info',
  procesado: 'success',
  rechazado: 'destructive',
};

interface SearchParams {
  estatus?: string;
  q?: string;
}

export default async function ReembolsosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermiso('reembolsos.aprobar');
  const sp = await searchParams;
  const estatus = (sp.estatus ?? 'todos') as 'todos' | EstatusReembolso;
  const q = sp.q?.trim() ?? '';

  const filter: Parameters<typeof listarReembolsos>[0] = { limit: 100 };
  if (estatus !== 'todos') filter.estatus = estatus;
  if (q) filter.q = q;
  const { rows, total } = await listarReembolsos(filter);

  return (
    <>
      <PageHeader
        title="Reembolsos"
        description={`${formatNumero(total)} solicitudes`}
      />

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por motivo o cliente"
          className="h-10 flex-1 min-w-[200px] rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
        {estatus !== 'todos' ? <input type="hidden" name="estatus" value={estatus} /> : null}
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Buscar
        </button>
      </form>

      <nav className="mb-4 flex flex-wrap gap-1.5">
        {FILTROS.map((f) => {
          const active = estatus === f.key;
          const params = new URLSearchParams();
          if (f.key !== 'todos') params.set('estatus', f.key);
          if (q) params.set('q', q);
          const href = `/dashboard/reembolsos${params.toString() ? `?${params.toString()}` : ''}`;
          return (
            <Link
              key={f.key}
              href={href}
              className={cn(
                'inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium',
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
          icon={ChartLine}
          title="Sin reembolsos"
          description={
            q || estatus !== 'todos'
              ? 'Ningún resultado para tu filtro.'
              : 'Cuando un cliente solicite un reembolso aparecerá aquí.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Cliente</th>
                <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">
                  Servicio
                </th>
                <th className="px-4 py-2.5 text-right font-medium">Monto</th>
                <th className="hidden px-4 py-2.5 text-left font-medium lg:table-cell">
                  Solicitado
                </th>
                <th className="px-4 py-2.5 text-left font-medium">Estado</th>
                <th className="w-10 px-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{r.cliente_nombre}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {r.servicio_nombre}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-medium">
                    {formatMoneda(r.monto)}
                    <span className="block text-xs text-muted-foreground">
                      de {formatMoneda(r.monto_pago)}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {formatFechaCorta(r.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={VARIANT_BY_ESTATUS[r.estatus]}>
                      {ESTATUS_REEMBOLSO_LABEL[r.estatus]}
                    </Badge>
                  </td>
                  <td className="px-2">
                    <Link
                      href={`/dashboard/reembolsos/${r.id}`}
                      className="inline-flex items-center text-muted-foreground hover:text-foreground"
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
