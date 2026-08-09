import type { Metadata } from 'next';
import Link from 'next/link';
import { CaretRight, Image as ImageIcon, Plus } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { formatFechaCorta, formatNumero } from '@/lib/dashboard/format';
import { listarBanners, SEGMENTO_LABEL } from '@/lib/dashboard/queries/banners';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Banners · ExpressMX' };

export default async function BannersPage() {
  const viewer = await requirePermiso('banners.gestionar');
  const banners = await listarBanners();
  const canManage = tienePermiso(viewer, 'banners.gestionar');
  const vigentes = banners.filter((b) => b.vigente).length;

  return (
    <>
      <PageHeader
        title="Banners"
        description={`${formatNumero(vigentes)} vigentes de ${formatNumero(banners.length)}`}
        actions={
          canManage ? (
            <Link
              href="/dashboard/banners/nuevo"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus size={14} aria-hidden />
              Nuevo banner
            </Link>
          ) : null
        }
      />

      {banners.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="Sin banners"
          description="Crea el primer banner para mostrarlo en la app del cliente."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {banners.map((b) => (
            <li key={b.id}>
              <Link
                href={`/dashboard/banners/${b.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-ring/40"
              >
                <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
                  <img
                    src={b.imagen_url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold line-clamp-1">{b.titulo}</p>
                    <CaretRight
                      size={14}
                      className="text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {SEGMENTO_LABEL[b.segmento]} · prioridad {b.orden_prioridad}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFechaCorta(b.fecha_inicio)} → {formatFechaCorta(b.fecha_fin)}
                  </p>
                  <div className="mt-auto pt-2">
                    {b.vigente ? (
                      <Badge variant="success">Vigente</Badge>
                    ) : !b.activo ? (
                      <Badge variant="muted">Pausado</Badge>
                    ) : new Date(b.fecha_inicio).getTime() > Date.now() ? (
                      <Badge variant="info">Próximo</Badge>
                    ) : (
                      <Badge variant="muted">Expirado</Badge>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
