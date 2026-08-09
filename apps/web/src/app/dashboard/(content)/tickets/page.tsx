import type { Metadata } from 'next';
import Link from 'next/link';
import { CaretRight, Lifebuoy } from '@phosphor-icons/react/ssr';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { PrioridadBadge } from '@/components/dashboard/prioridad-badge';
import { TicketEstatusBadge } from '@/components/dashboard/ticket-estatus-badge';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { formatFechaHora, formatNumero } from '@/lib/dashboard/format';
import {
  CATEGORIA_LABEL,
  listarTickets,
  type EstatusTicket,
  type PrioridadTicket,
  type TicketsFilter,
} from '@/lib/dashboard/queries/tickets';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tickets · ExpressMX' };

const ESTATUS_FILTROS: Array<{ key: 'todos' | EstatusTicket; label: string }> = [
  { key: 'todos', label: 'Todos' },
  { key: 'abierto', label: 'Abiertos' },
  { key: 'en_revision', label: 'En revisión' },
  { key: 'escalado', label: 'Escalados' },
  { key: 'resuelto', label: 'Resueltos' },
];

interface SearchParams {
  estatus?: string;
  prioridad?: string;
  asignacion?: string;
  q?: string;
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requirePermiso('tickets.ver');
  const sp = await searchParams;

  const estatus = (sp.estatus ?? 'todos') as 'todos' | EstatusTicket;
  const prioridad = (sp.prioridad ?? 'todas') as 'todas' | PrioridadTicket;
  const asignacion = (sp.asignacion ?? 'todos') as 'todos' | 'sin_asignar' | 'mios';
  const q = sp.q?.trim() ?? '';

  const filter: TicketsFilter = { limit: 100, agente_id: viewer.userId };
  if (estatus !== 'todos') filter.estatus = estatus;
  if (prioridad !== 'todas') filter.prioridad = prioridad;
  if (asignacion !== 'todos') filter.asignacion = asignacion;
  if (q) filter.q = q;

  const { rows, total } = await listarTickets(filter);

  return (
    <>
      <PageHeader
        title="Tickets de soporte"
        description={`${formatNumero(total)} tickets en este filtro`}
      />

      <form method="get" className="mb-4 grid gap-2 md:grid-cols-[1fr_auto_auto_auto_auto]">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por asunto o cliente"
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
        <select
          name="prioridad"
          defaultValue={prioridad}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-ring"
        >
          <option value="todas">Cualquier prioridad</option>
          <option value="critica">Crítica</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>
        <select
          name="asignacion"
          defaultValue={asignacion}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-ring"
        >
          <option value="todos">Toda asignación</option>
          <option value="sin_asignar">Sin asignar</option>
          <option value="mios">Asignados a mí</option>
        </select>
        {estatus !== 'todos' ? <input type="hidden" name="estatus" value={estatus} /> : null}
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Filtrar
        </button>
      </form>

      <nav className="mb-4 flex flex-wrap gap-1.5">
        {ESTATUS_FILTROS.map((f) => {
          const active = estatus === f.key;
          const params = new URLSearchParams();
          if (f.key !== 'todos') params.set('estatus', f.key);
          if (prioridad !== 'todas') params.set('prioridad', prioridad);
          if (asignacion !== 'todos') params.set('asignacion', asignacion);
          if (q) params.set('q', q);
          const href = `/dashboard/tickets${params.toString() ? `?${params.toString()}` : ''}`;
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
          icon={Lifebuoy}
          title="Sin tickets"
          description="Cuando un cliente o prestador abra un reporte aparecerá aquí."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Asunto</th>
                <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">
                  Cliente
                </th>
                <th className="hidden px-4 py-2.5 text-left font-medium lg:table-cell">
                  Categoría
                </th>
                <th className="hidden px-4 py-2.5 text-left font-medium lg:table-cell">
                  Asignado
                </th>
                <th className="px-4 py-2.5 text-left font-medium">Prioridad</th>
                <th className="px-4 py-2.5 text-left font-medium">Estatus</th>
                <th className="hidden px-4 py-2.5 text-left font-medium lg:table-cell">
                  Actualizado
                </th>
                <th className="w-10 px-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-medium line-clamp-1">{t.asunto}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.mensajes_count} mensaje{t.mensajes_count === 1 ? '' : 's'}
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {t.usuario_nombre}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {CATEGORIA_LABEL[t.categoria]}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {t.agente_nombre ?? <span className="italic">Sin asignar</span>}
                  </td>
                  <td className="px-4 py-3">
                    <PrioridadBadge prioridad={t.prioridad} />
                  </td>
                  <td className="px-4 py-3">
                    <TicketEstatusBadge estatus={t.estatus} />
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                    {formatFechaHora(t.updated_at)}
                  </td>
                  <td className="px-2">
                    <Link
                      href={`/dashboard/tickets/${t.id}`}
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
