import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react/ssr';
import { BannerForm } from '@/components/dashboard/banner-form';
import { PageHeader } from '@/components/dashboard/page-header';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Nuevo banner · ExpressMX' };

export default async function NuevoBannerPage() {
  await requirePermiso('banners.gestionar');

  return (
    <>
      <Link
        href="/dashboard/banners"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} aria-hidden /> Volver a banners
      </Link>

      <PageHeader
        title="Nuevo banner"
        description="Sube la imagen y define la vigencia. Aparecerá en el carrusel de la app del cliente."
      />

      <div className="max-w-2xl">
        <BannerForm mode="create" />
      </div>
    </>
  );
}
