import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { CategoriaForm } from '@/components/dashboard/categoria-form';
import { PageHeader } from '@/components/dashboard/page-header';
import { WorkspaceBreadcrumbs } from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { formatNumero } from '@/lib/dashboard/format';
import { getCategoria } from '@/lib/dashboard/queries/catalogo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Categoría · ExpressMX' };

export default async function CategoriaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermiso('catalogo.gestionar');
  const { id } = await params;
  const categoria = await getCategoria(id);
  if (!categoria) notFound();

  return (
    <>
      <WorkspaceBreadcrumbs
        className="mb-3"
        items={[
          { label: 'Categorías', href: '/dashboard/categorias' },
          { label: categoria.nombre },
        ]}
      />

      <PageHeader
        title={categoria.nombre}
        description={`${formatNumero(categoria.servicios_count)} servicios en esta categoría`}
        actions={
          categoria.activa ? (
            <Badge variant="success">Activa</Badge>
          ) : (
            <Badge variant="muted">Pausada</Badge>
          )
        }
      />

      <div className="max-w-xl">
        <CategoriaForm
          mode="edit"
          categoriaId={categoria.id}
          serviciosCount={categoria.servicios_count}
          initial={{
            nombre: categoria.nombre,
            descripcion: categoria.descripcion,
            orden_despliegue: categoria.orden_despliegue,
            activa: categoria.activa,
          }}
        />
      </div>
    </>
  );
}
