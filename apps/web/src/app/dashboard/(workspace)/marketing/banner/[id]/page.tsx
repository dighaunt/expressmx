import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { BannerForm } from '@/components/dashboard/banner-form';
import { MarketingQueue } from '@/components/dashboard/marketing-queue';
import {
  ContextSidebar,
  ItemForm,
  WorkspaceBreadcrumbs,
  WorkspaceShell,
} from '@/components/workspace';
import { ForbiddenError } from '@/lib/errors/http-errors';
import { requireViewer } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { formatFechaLarga } from '@/lib/dashboard/format';
import { getBanner } from '@/lib/dashboard/queries/banners';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Banner · Marketing · ExpressMX' };

const SEGMENTO_LABEL: Record<string, string> = {
  todos: 'Todos los clientes',
  nuevos: 'Nuevos clientes',
  recurrentes: 'Clientes recurrentes',
};

export default async function BannerWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireViewer();
  if (!tienePermiso(viewer, 'banners.gestionar')) {
    throw new ForbiddenError('Necesitas permiso banners.gestionar');
  }
  const { id } = await params;
  const banner = await getBanner(id);
  if (!banner) notFound();

  const fueraVigencia =
    new Date(banner.fecha_inicio).getTime() > Date.now() ||
    new Date(banner.fecha_fin).getTime() < Date.now();

  return (
    <WorkspaceShell
      accent="marketing"
      header={
        <div className="min-w-0">
          <WorkspaceBreadcrumbs
            items={[
              { label: 'Marketing', href: '/dashboard/marketing' },
              {
                label: 'Banners',
                href: '/dashboard/marketing?bucket=banners_vigentes',
              },
              { label: banner.titulo },
            ]}
          />
          <h1 className="mt-1 text-base font-semibold truncate">{banner.titulo}</h1>
        </div>
      }
      queue={<MarketingQueue active={{ kind: 'banner', id: banner.id }} bucket="banners_vigentes" />}
      main={
        <ItemForm
          title={banner.titulo}
          subtitle={SEGMENTO_LABEL[banner.segmento] ?? banner.segmento}
          badges={
            banner.vigente ? (
              <Badge variant="success">Vigente</Badge>
            ) : !banner.activo ? (
              <Badge variant="muted">Pausado</Badge>
            ) : (
              <Badge variant="destructive">Fuera de vigencia</Badge>
            )
          }
          meta={
            <span>
              {formatFechaLarga(banner.fecha_inicio)} →{' '}
              {formatFechaLarga(banner.fecha_fin)} · prioridad {banner.orden_prioridad}
            </span>
          }
          fields={
            <BannerForm
              mode="edit"
              bannerId={banner.id}
              initial={{
                titulo: banner.titulo,
                imagen_url: banner.imagen_url,
                url_destino: banner.url_destino,
                fecha_inicio: banner.fecha_inicio.slice(0, 10),
                fecha_fin: banner.fecha_fin.slice(0, 10),
                orden_prioridad: banner.orden_prioridad,
                segmento: banner.segmento,
                activo: banner.activo,
              }}
            />
          }
        />
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'preview',
              title: 'Preview',
              children: banner.imagen_url ? (
                <a
                  href={banner.imagen_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-lg border border-border bg-muted/40"
                >
                  <img
                    src={banner.imagen_url}
                    alt={banner.titulo}
                    className="w-full object-cover"
                  />
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">Sin imagen.</p>
              ),
            },
            {
              key: 'destino',
              title: 'URL de destino',
              children: banner.url_destino ? (
                <a
                  href={banner.url_destino}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-xs text-primary hover:underline"
                >
                  {banner.url_destino}
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">Sin enlace.</p>
              ),
            },
            ...(fueraVigencia
              ? [
                  {
                    key: 'aviso',
                    title: 'Aviso',
                    children: (
                      <p className="rounded-md border border-warning/40 bg-warning/5 p-2 text-xs text-warning-foreground">
                        Este banner está fuera del rango de fechas configurado. No se
                        muestra a usuarios aunque esté marcado activo.
                      </p>
                    ),
                  },
                ]
              : []),
          ]}
        />
      }
    />
  );
}
