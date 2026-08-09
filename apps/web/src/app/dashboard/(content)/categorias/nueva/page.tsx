import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react/ssr';
import { CategoriaForm } from '@/components/dashboard/categoria-form';
import { PageHeader } from '@/components/dashboard/page-header';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Nueva categoría · ExpressMX' };

export default async function NuevaCategoriaPage() {
  await requirePermiso('catalogo.gestionar');

  return (
    <>
      <Link
        href="/dashboard/categorias"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} aria-hidden /> Volver a categorías
      </Link>

      <PageHeader
        title="Nueva categoría"
        description="Las categorías agrupan servicios afines en la app del cliente."
      />

      <div className="max-w-xl">
        <CategoriaForm mode="create" />
      </div>
    </>
  );
}
