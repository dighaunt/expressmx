import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/dashboard/page-header';
import { ServicioEditForm } from '@/components/dashboard/servicio-edit-form';
import { WorkspaceBreadcrumbs } from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { formatMoneda, formatNumero } from '@/lib/dashboard/format';
import { getServicio, listarCategorias } from '@/lib/dashboard/queries/catalogo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Servicio · ExpressMX' };

export default async function ServicioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePermiso('catalogo.ver');
  const { id } = await params;
  const [servicio, categorias] = await Promise.all([getServicio(id), listarCategorias()]);
  if (!servicio) notFound();

  const canEdit = tienePermiso(viewer, 'catalogo.editar');

  return (
    <>
      <WorkspaceBreadcrumbs
        className="mb-3"
        items={[
          { label: 'Servicios', href: '/dashboard/servicios' },
          { label: servicio.nombre },
        ]}
      />

      <PageHeader
        title={servicio.nombre}
        description={servicio.categoria_nombre}
        actions={
          servicio.activo ? (
            <Badge variant="success">Activo</Badge>
          ) : (
            <Badge variant="muted">Inactivo</Badge>
          )
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Prestadores activos" value={formatNumero(servicio.prestadores_count)} />
        <Stat label="Órdenes generadas" value={formatNumero(servicio.ordenes_count)} />
        <Stat
          label="Duración estimada"
          value={
            servicio.duracion_estimada_min ? `${servicio.duracion_estimada_min} min` : '—'
          }
        />
        <Stat
          label="Rango de precio"
          value={
            servicio.precio_maximo
              ? `${formatMoneda(servicio.precio_base)}–${formatMoneda(servicio.precio_maximo)}`
              : formatMoneda(servicio.precio_base)
          }
        />
      </section>

      <ServicioEditForm
        servicioId={servicio.id}
        initial={{
          nombre: servicio.nombre,
          descripcion: servicio.descripcion,
          precio_base: Number(servicio.precio_base),
          precio_maximo: servicio.precio_maximo === null ? null : Number(servicio.precio_maximo),
          duracion_estimada_min: servicio.duracion_estimada_min,
          categoria_id: servicio.categoria_id,
          activo: servicio.activo,
        }}
        categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
        canEdit={canEdit}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}
