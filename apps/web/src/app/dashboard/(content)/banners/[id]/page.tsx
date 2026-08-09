import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { BannerForm } from '@/components/dashboard/banner-form';
import { PageHeader } from '@/components/dashboard/page-header';
import { WorkspaceBreadcrumbs } from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { getBanner, SEGMENTO_LABEL } from '@/lib/dashboard/queries/banners';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Banner · ExpressMX' };

export default async function BannerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermiso('banners.gestionar');
  const { id } = await params;
  const banner = await getBanner(id);
  if (!banner) notFound();

  return (
    <>
      <WorkspaceBreadcrumbs
        className="mb-3"
        items={[
          { label: 'Banners', href: '/dashboard/banners' },
          { label: banner.titulo },
        ]}
      />

      <PageHeader
        title={banner.titulo}
        description={SEGMENTO_LABEL[banner.segmento]}
        actions={
          banner.vigente ? (
            <Badge variant="success">Vigente</Badge>
          ) : !banner.activo ? (
            <Badge variant="muted">Pausado</Badge>
          ) : (
            <Badge variant="muted">Fuera de vigencia</Badge>
          )
        }
      />

      <div className="max-w-2xl">
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
      </div>
    </>
  );
}
