import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react/ssr';
import { ZonaForm } from '@/components/dashboard/zona-form';
import { PageHeader } from '@/components/dashboard/page-header';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Nueva zona · ExpressMX' };

export default async function NuevaZonaPage() {
  await requirePermiso('zonas.gestionar');

  return (
    <>
      <Link
        href="/dashboard/zonas"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} aria-hidden /> Volver a zonas
      </Link>

      <PageHeader
        title="Nueva zona"
        description="Define un área de cobertura con su centro y radio."
      />

      <div className="max-w-xl">
        <ZonaForm mode="create" />
      </div>
    </>
  );
}
