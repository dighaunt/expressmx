import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { InvitacionRowActions } from '@/components/dashboard/invitacion-row-actions';
import { PageHeader } from '@/components/dashboard/page-header';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { formatFechaCorta, formatFechaHora, formatNumero } from '@/lib/dashboard/format';
import {
  listarInvitaciones,
  type EstadoInvitacion,
} from '@/lib/dashboard/queries/invitaciones';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Invitaciones · ExpressMX' };

const FILTROS: Array<{ key: 'todas' | EstadoInvitacion; label: string }> = [
  { key: 'todas', label: 'Todas' },
  { key: 'disponible', label: 'Disponibles' },
  { key: 'usada', label: 'Usadas' },
  { key: 'revocada', label: 'Revocadas' },
  { key: 'expirada', label: 'Expiradas' },
];

const VARIANT_BY_ESTADO: Record<
  EstadoInvitacion,
  'success' | 'info' | 'destructive' | 'muted'
> = {
  disponible: 'success',
  usada: 'info',
  revocada: 'destructive',
  expirada: 'muted',
};

const LABEL_BY_ESTADO: Record<EstadoInvitacion, string> = {
  disponible: 'Disponible',
  usada: 'Usada',
  revocada: 'Revocada',
  expirada: 'Expirada',
};

interface SearchParams {
  estado?: string;
  q?: string;
}

export default async function InvitacionesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requirePermiso('prestadores.invitar');
  const sp = await searchParams;
  const estado = (sp.estado ?? 'todas') as 'todas' | EstadoInvitacion;
  const q = sp.q?.trim() ?? '';

  const filter: Parameters<typeof listarInvitaciones>[0] = { limit: 100 };
  if (estado !== 'todas') filter.estado = estado;
  if (q) filter.q = q;
  const { rows, total } = await listarInvitaciones(filter);
  const puedeInvitar = tienePermiso(viewer, 'prestadores.invitar');

  return (
    <>
      <PageHeader
        title="Invitaciones"
        description={`${formatNumero(total)} códigos generados en total`}
        actions={
          puedeInvitar ? (
            <Link
              href="/dashboard/invitaciones/nueva"
              className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Generar código
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
          className="h-10 flex-1 min-w-[200px] rounded-lg border border-border bg-background px-3 text-sm uppercase tracking-wider outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
        {estado !== 'todas' ? <input type="hidden" name="estado" value={estado} /> : null}
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
          if (f.key !== 'todas') params.set('estado', f.key);
          if (q) params.set('q', q);
          const href = `/dashboard/invitaciones${params.toString() ? `?${params.toString()}` : ''}`;
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
          icon={ShieldCheck}
          title="Sin invitaciones"
          description={
            q || estado !== 'todas'
              ? 'Ningún resultado para tu filtro.'
              : 'Genera la primera invitación para que un prestador pueda registrarse.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Código</th>
                <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">
                  Notas
                </th>
                <th className="px-4 py-2.5 text-left font-medium">Estado</th>
                <th className="hidden px-4 py-2.5 text-left font-medium lg:table-cell">
                  Generada
                </th>
                <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">
                  Vence
                </th>
                <th className="hidden px-4 py-2.5 text-left font-medium lg:table-cell">
                  Usada por
                </th>
                <th className="w-32 px-4 py-2.5 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((inv) => (
                <tr key={inv.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-sm font-semibold tracking-wider">
                    {inv.codigo}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell max-w-xs truncate">
                    {inv.notas ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={VARIANT_BY_ESTADO[inv.estado]}
                    >
                      {LABEL_BY_ESTADO[inv.estado]}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {formatFechaCorta(inv.creado_en)}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {formatFechaCorta(inv.expira_en)}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {inv.usado_por_nombre
                      ? `${inv.usado_por_nombre} · ${formatFechaCorta(inv.usado_en)}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {inv.estado === 'disponible' && puedeInvitar ? (
                      <InvitacionRowActions invitacionId={inv.id} codigo={inv.codigo} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
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
