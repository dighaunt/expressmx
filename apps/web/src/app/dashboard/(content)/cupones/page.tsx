import type { Metadata } from 'next';
import Link from 'next/link';
import { CaretRight, Plus, Tag } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { formatFechaCorta, formatMoneda, formatNumero } from '@/lib/dashboard/format';
import {
  listarCupones,
  type EstadoCupon,
} from '@/lib/dashboard/queries/cupones';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Cupones · ExpressMX' };

const FILTROS: Array<{ key: 'todos' | EstadoCupon; label: string }> = [
  { key: 'todos', label: 'Todos' },
  { key: 'activo', label: 'Activos' },
  { key: 'futuro', label: 'Futuros' },
  { key: 'agotado', label: 'Agotados' },
  { key: 'expirado', label: 'Expirados' },
];

const VARIANT_BY_ESTADO: Record<EstadoCupon, 'success' | 'warning' | 'muted' | 'info'> = {
  activo: 'success',
  futuro: 'info',
  agotado: 'muted',
  expirado: 'muted',
};

const LABEL_BY_ESTADO: Record<EstadoCupon, string> = {
  activo: 'Activo',
  futuro: 'Próximo',
  agotado: 'Agotado',
  expirado: 'Expirado',
};

interface SearchParams {
  estado?: string;
  q?: string;
}

export default async function CuponesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requirePermiso('cupones.gestionar');
  const sp = await searchParams;
  const estado = (sp.estado ?? 'todos') as 'todos' | EstadoCupon;
  const q = sp.q?.trim() ?? '';
  const canManage = tienePermiso(viewer, 'cupones.gestionar');

  const filter: Parameters<typeof listarCupones>[0] = { limit: 100 };
  if (estado !== 'todos') filter.estado = estado;
  if (q) filter.q = q;
  const { rows, total } = await listarCupones(filter);

  return (
    <>
      <PageHeader
        title="Cupones"
        description={`${formatNumero(total)} cupones generados`}
        actions={
          canManage ? (
            <Link
              href="/dashboard/cupones/nuevo"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus size={14} aria-hidden />
              Nuevo cupón
            </Link>
          ) : null
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por código"
          className="h-10 flex-1 min-w-[200px] rounded-lg border border-border bg-background px-3 text-sm uppercase tracking-wider outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
        {estado !== 'todos' ? <input type="hidden" name="estado" value={estado} /> : null}
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
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
          const href = `/dashboard/cupones${params.toString() ? `?${params.toString()}` : ''}`;
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
          icon={Tag}
          title="Sin cupones"
          description={
            q || estado !== 'todos'
              ? 'Ningún resultado para tu filtro.'
              : 'Crea tu primer cupón para empezar a ofrecer descuentos.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Código</th>
                <th className="px-4 py-2.5 text-left font-medium">Descuento</th>
                <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">
                  Vigencia
                </th>
                <th className="px-4 py-2.5 text-right font-medium">Usos</th>
                <th className="hidden px-4 py-2.5 text-left font-medium lg:table-cell">
                  Categoría
                </th>
                <th className="px-4 py-2.5 text-left font-medium">Estado</th>
                <th className="w-10 px-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono font-semibold tracking-wider">{c.codigo}</td>
                  <td className="px-4 py-3">
                    {c.tipo_descuento === 'porcentaje'
                      ? `${formatNumero(c.valor)}%`
                      : formatMoneda(c.valor)}
                    {c.solo_primera_compra ? (
                      <span className="ml-2 text-xs text-muted-foreground">primera compra</span>
                    ) : null}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-muted-foreground md:table-cell">
                    {formatFechaCorta(c.fecha_inicio)} → {formatFechaCorta(c.fecha_expiracion)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {formatNumero(c.usos_actuales)} / {formatNumero(c.usos_maximos)}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {c.categoria_nombre ?? 'Todas'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={VARIANT_BY_ESTADO[c.estado]}>
                      {LABEL_BY_ESTADO[c.estado]}
                    </Badge>
                  </td>
                  <td className="px-2">
                    {canManage ? (
                      <Link
                        href={`/dashboard/cupones/${c.id}`}
                        className="inline-flex items-center text-muted-foreground hover:text-foreground"
                      >
                        <CaretRight size={16} aria-hidden />
                      </Link>
                    ) : null}
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
