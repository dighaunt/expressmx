import type { Metadata } from 'next';
import Link from 'next/link';
import { ClockCounterClockwise, FunnelSimple } from '@phosphor-icons/react/ssr';
import { EmptyState } from '@/components/dashboard/empty-state';
import { LogDetalle } from '@/components/dashboard/log-detalle';
import { PageHeader } from '@/components/dashboard/page-header';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { formatFechaHora, formatNumero } from '@/lib/dashboard/format';
import {
  listarAdminsAuditados,
  listarEntidadesAuditadas,
  listarLogs,
  type AuditoriaFilter,
} from '@/lib/dashboard/queries/auditoria';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Auditoría · ExpressMX' };

const PAGE_SIZE = 50;

interface SearchParams {
  q?: string;
  admin?: string;
  entidad?: string;
  desde?: string;
  hasta?: string;
  page?: string;
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermiso('auditoria.ver');
  const sp = await searchParams;

  const q = sp.q?.trim() ?? '';
  const adminId = sp.admin?.trim() ?? '';
  const entidad = sp.entidad?.trim() ?? '';
  const desde = sp.desde?.trim() ?? '';
  const hasta = sp.hasta?.trim() ?? '';
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const filter: AuditoriaFilter = {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };
  if (q) filter.q = q;
  if (adminId) filter.adminId = adminId;
  if (entidad) filter.entidad = entidad;
  if (desde) filter.desde = desde;
  if (hasta) filter.hasta = hasta;

  const [{ rows, total }, entidades, admins] = await Promise.all([
    listarLogs(filter),
    listarEntidadesAuditadas(),
    listarAdminsAuditados(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Auditoría"
        description={`${formatNumero(total)} eventos registrados`}
      />

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
            placeholder="Buscar acción o entidad"
            className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <select
          name="admin"
          defaultValue={adminId}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
        >
          <option value="">Todos los admins</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
        <select
          name="entidad"
          defaultValue={entidad}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
        >
          <option value="">Todas las entidades</option>
          {entidades.map((e) => (
            <option key={e} value={e}>
              {e}
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
          icon={ClockCounterClockwise}
          title="Sin eventos"
          description={
            q || adminId || entidad || desde || hasta
              ? 'Ningún evento coincide con tu filtro.'
              : 'Cuando los admins ejecuten acciones aparecerán aquí.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Fecha</th>
                <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">
                  Admin
                </th>
                <th className="px-4 py-2.5 text-left font-medium">Acción</th>
                <th className="hidden px-4 py-2.5 text-left font-medium lg:table-cell">
                  Entidad
                </th>
                <th className="hidden px-4 py-2.5 text-left font-medium lg:table-cell">
                  Origen
                </th>
                <th className="px-4 py-2.5 text-right font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((l) => (
                <tr key={l.id} className="align-top hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatFechaHora(l.created_at)}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="font-medium">{l.admin_nombre || 'Desconocido'}</div>
                    {l.admin_email ? (
                      <div className="text-xs text-muted-foreground">{l.admin_email}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <code className="font-mono text-xs">{l.accion}</code>
                    {l.entidad_id ? (
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {l.entidad_id.slice(0, 8)}…
                      </div>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px]">
                      {l.entidad}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                    {l.ip_address ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <LogDetalle
                      accion={l.accion}
                      entidad={l.entidad}
                      anterior={l.valor_anterior}
                      nuevo={l.valor_nuevo}
                    />
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
              <PageLink
                page={page - 1}
                q={q}
                admin={adminId}
                entidad={entidad}
                desde={desde}
                hasta={hasta}
              >
                Anterior
              </PageLink>
            ) : null}
            {page < totalPages ? (
              <PageLink
                page={page + 1}
                q={q}
                admin={adminId}
                entidad={entidad}
                desde={desde}
                hasta={hasta}
              >
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
  q,
  admin,
  entidad,
  desde,
  hasta,
  children,
}: {
  page: number;
  q: string;
  admin: string;
  entidad: string;
  desde: string;
  hasta: string;
  children: React.ReactNode;
}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (admin) params.set('admin', admin);
  if (entidad) params.set('entidad', entidad);
  if (desde) params.set('desde', desde);
  if (hasta) params.set('hasta', hasta);
  if (page > 1) params.set('page', String(page));
  const href = `/dashboard/auditoria${params.toString() ? `?${params.toString()}` : ''}`;
  return (
    <Link
      href={href}
      className="rounded-md border border-border bg-card px-3 py-1.5 font-medium text-foreground hover:bg-muted"
    >
      {children}
    </Link>
  );
}
