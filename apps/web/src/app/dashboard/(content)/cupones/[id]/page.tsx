import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { CuponForm } from '@/components/dashboard/cupon-form';
import { PageHeader } from '@/components/dashboard/page-header';
import { WorkspaceBreadcrumbs } from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { formatNumero } from '@/lib/dashboard/format';
import { listarCategorias } from '@/lib/dashboard/queries/catalogo';
import { getCupon } from '@/lib/dashboard/queries/cupones';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Cupón · ExpressMX' };

const VARIANT = {
  activo: 'success',
  futuro: 'info',
  agotado: 'muted',
  expirado: 'muted',
} as const;

const LABEL = {
  activo: 'Activo',
  futuro: 'Próximo',
  agotado: 'Agotado',
  expirado: 'Expirado',
};

export default async function CuponDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermiso('cupones.gestionar');
  const { id } = await params;
  const [cupon, categorias] = await Promise.all([getCupon(id), listarCategorias()]);
  if (!cupon) notFound();

  return (
    <>
      <WorkspaceBreadcrumbs
        className="mb-3"
        items={[
          { label: 'Cupones', href: '/dashboard/cupones' },
          { label: cupon.codigo },
        ]}
      />

      <PageHeader
        title={cupon.codigo}
        description={`${formatNumero(cupon.usos_actuales)} de ${formatNumero(cupon.usos_maximos)} usos`}
        actions={<Badge variant={VARIANT[cupon.estado]}>{LABEL[cupon.estado]}</Badge>}
      />

      <div className="max-w-2xl">
        <CuponForm
          mode="edit"
          cuponId={cupon.id}
          usosActuales={cupon.usos_actuales}
          estado={cupon.estado}
          categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
          initial={{
            codigo: cupon.codigo,
            tipo_descuento: cupon.tipo_descuento,
            valor: Number(cupon.valor),
            fecha_inicio: cupon.fecha_inicio.slice(0, 10),
            fecha_expiracion: cupon.fecha_expiracion.slice(0, 10),
            usos_maximos: cupon.usos_maximos,
            solo_primera_compra: cupon.solo_primera_compra,
            categoria_id: cupon.categoria_id,
          }}
        />
      </div>
    </>
  );
}
