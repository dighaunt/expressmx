import type { Metadata } from 'next';
import Link from 'next/link';
import { CaretRight, Plus, Tag } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { formatNumero } from '@/lib/dashboard/format';
import { listarCategorias } from '@/lib/dashboard/queries/catalogo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Categorías · ExpressMX' };

export default async function CategoriasPage() {
  const viewer = await requirePermiso('catalogo.ver');
  const categorias = await listarCategorias();
  const canManage = tienePermiso(viewer, 'catalogo.gestionar');

  return (
    <>
      <PageHeader
        title="Categorías de servicio"
        description={`${formatNumero(categorias.length)} categorías`}
        actions={
          canManage ? (
            <Link
              href="/dashboard/categorias/nueva"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus size={14} aria-hidden />
              Nueva categoría
            </Link>
          ) : null
        }
      />

      {categorias.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Sin categorías"
          description="Crea la primera categoría para empezar a clasificar servicios."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Categoría</th>
                <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">
                  Descripción
                </th>
                <th className="px-4 py-2.5 text-right font-medium">Servicios</th>
                <th className="hidden px-4 py-2.5 text-right font-medium lg:table-cell">
                  Orden
                </th>
                <th className="px-4 py-2.5 text-left font-medium">Estado</th>
                <th className="w-10 px-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categorias.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{c.nombre}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell max-w-md truncate">
                    {c.descripcion ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {formatNumero(c.servicios_count)}
                  </td>
                  <td className="hidden px-4 py-3 text-right text-muted-foreground tabular-nums lg:table-cell">
                    {c.orden_despliegue}
                  </td>
                  <td className="px-4 py-3">
                    {c.activa ? (
                      <Badge variant="success">Activa</Badge>
                    ) : (
                      <Badge variant="muted">Pausada</Badge>
                    )}
                  </td>
                  <td className="px-2">
                    {canManage ? (
                      <Link
                        href={`/dashboard/categorias/${c.id}`}
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
