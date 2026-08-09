import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Tag } from '@phosphor-icons/react/ssr';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { ServicioEditForm } from '@/components/dashboard/servicio-edit-form';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { listarCategorias } from '@/lib/dashboard/queries/catalogo';
import { ForbiddenError } from '@/lib/errors/http-errors';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Nuevo servicio · ExpressMX' };

export default async function NuevoServicioPage() {
  const viewer = await requirePermiso('catalogo.ver');
  if (!tienePermiso(viewer, 'catalogo.crear')) {
    throw new ForbiddenError('No tienes permiso para crear servicios');
  }

  const categorias = await listarCategorias();
  const categoriasActivas = categorias.filter((c) => c.activa);
  const canManageCategories = tienePermiso(viewer, 'catalogo.gestionar');

  return (
    <>
      <Link
        href="/dashboard/servicios"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} aria-hidden /> Volver a servicios
      </Link>

      <PageHeader
        title="Crear servicio"
        description="Alta administrativa para el catálogo de servicios."
        actions={
          <Link
            href="/dashboard/categorias"
            className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
          >
            Ver categorías
          </Link>
        }
      />

      {categoriasActivas.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Sin categorías activas"
          description="Crea o activa una categoría antes de registrar servicios."
          action={
            <Link
              href={canManageCategories ? '/dashboard/categorias/nueva' : '/dashboard/categorias'}
              className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {canManageCategories ? 'Crear categoría' : 'Ver categorías'}
            </Link>
          }
        />
      ) : (
        <div className="max-w-2xl">
          <ServicioEditForm
            mode="create"
            initial={{
              nombre: '',
              descripcion: '',
              precio_base: 0,
              precio_maximo: null,
              duracion_estimada_min: null,
              categoria_id: categoriasActivas[0]?.id ?? '',
              activo: true,
            }}
            categorias={categoriasActivas.map((c) => ({ id: c.id, nombre: c.nombre }))}
            canEdit
          />
        </div>
      )}
    </>
  );
}