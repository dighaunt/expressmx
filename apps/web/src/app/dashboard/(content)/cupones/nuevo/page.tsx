import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react/ssr';
import { CuponForm } from '@/components/dashboard/cupon-form';
import { PageHeader } from '@/components/dashboard/page-header';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { listarCategorias } from '@/lib/dashboard/queries/catalogo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Nuevo cupón · ExpressMX' };

export default async function NuevoCuponPage() {
  await requirePermiso('cupones.gestionar');
  const categorias = await listarCategorias();

  return (
    <>
      <Link
        href="/dashboard/cupones"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} aria-hidden /> Volver a cupones
      </Link>

      <PageHeader
        title="Nuevo cupón"
        description="Define el descuento y los términos. Solo se aplica a clientes elegibles."
      />

      <div className="max-w-2xl">
        <CuponForm
          mode="create"
          categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
        />
      </div>
    </>
  );
}
