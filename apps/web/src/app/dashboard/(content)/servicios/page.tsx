import type { Metadata } from 'next';
import Link from 'next/link';
import { CaretRight, FunnelSimple, Plus, Toolbox } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { formatMoneda, formatNumero } from '@/lib/dashboard/format';
import {
  listarCategorias,
  listarServicios,
  type ServiciosFilter,
} from '@/lib/dashboard/queries/catalogo';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Servicios · ExpressMX' };

interface SearchParams {
  q?: string;
  categoria_id?: string;
  estado?: string;
}

export default async function ServiciosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requirePermiso('catalogo.ver');
  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';
  const categoriaId = sp.categoria_id ?? '';
  const estado = (sp.estado ?? 'todos') as NonNullable<ServiciosFilter['estado']>;

  const filter: ServiciosFilter = { estado, limit: 200 };
  if (q) filter.q = q;
  if (categoriaId) filter.categoria_id = categoriaId;

  const [{ rows, total }, categorias] = await Promise.all([
    listarServicios(filter),
    listarCategorias(),
  ]);
  const canCreate = tienePermiso(viewer, 'catalogo.crear');

  return (
    <>
      <PageHeader
        title="Servicios"
        description={`${formatNumero(total)} servicios en el catálogo`}
        actions={
          <>
            {canCreate ? (
              <Link
                href="/dashboard/servicios/nuevo"
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus size={14} aria-hidden />
                Crear servicio
              </Link>
            ) : null}
            <Link
              href="/dashboard/categorias"
              className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
            >
              Ver categorías
            </Link>
          </>
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
            placeholder="Buscar por nombre o descripción"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <select
          name="categoria_id"
          defaultValue={categoriaId}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-ring"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <select
          name="estado"
          defaultValue={estado}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-ring"
        >
          <option value="todos">Todos</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Filtrar
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={Toolbox}
          title="Sin servicios"
          description="Ningún servicio coincide con el filtro."
          action={
            canCreate ? (
              <Link
                href="/dashboard/servicios/nuevo"
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus size={14} aria-hidden />
                Crear servicio
              </Link>
            ) : null
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Servicio</th>
                <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">
                  Categoría
                </th>
                <th className="px-4 py-2.5 text-right font-medium">Precio base</th>
                <th className="hidden px-4 py-2.5 text-right font-medium lg:table-cell">
                  Prestadores
                </th>
                <th className="hidden px-4 py-2.5 text-right font-medium lg:table-cell">
                  Órdenes
                </th>
                <th className="px-4 py-2.5 text-left font-medium">Estado</th>
                <th className="w-10 px-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.nombre}</div>
                    {s.descripcion ? (
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {s.descripcion}
                      </div>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {s.categoria_nombre}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {formatMoneda(s.precio_base)}
                    {s.precio_maximo && Number(s.precio_maximo) > Number(s.precio_base) ? (
                      <span className="text-xs text-muted-foreground">
                        {' '}
                        – {formatMoneda(s.precio_maximo)}
                      </span>
                    ) : null}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-right tabular-nums lg:table-cell">
                    {formatNumero(s.prestadores_count)}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-right tabular-nums lg:table-cell">
                    {formatNumero(s.ordenes_count)}
                  </td>
                  <td className="px-4 py-3">
                    {s.activo ? (
                      <Badge variant="success">Activo</Badge>
                    ) : (
                      <Badge variant="muted">Inactivo</Badge>
                    )}
                  </td>
                  <td className="px-2">
                    <Link
                      href={`/dashboard/servicios/${s.id}`}
                      className="inline-flex items-center text-muted-foreground hover:text-foreground"
                      aria-label={`Editar ${s.nombre}`}
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

      <p className="mt-3 text-xs text-muted-foreground">
        Tip: pulsa la flecha para abrir el editor del servicio.
      </p>

      <span className="sr-only">{cn()}</span>
    </>
  );
}
