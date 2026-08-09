import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Tag } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { CuponForm } from '@/components/dashboard/cupon-form';
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
import { formatFechaLarga, formatMoneda, formatNumero } from '@/lib/dashboard/format';
import { listarCategorias } from '@/lib/dashboard/queries/catalogo';
import { getCupon } from '@/lib/dashboard/queries/cupones';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Cupón · Marketing · ExpressMX' };

const ESTADO_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'muted'> = {
  activo: 'success',
  futuro: 'warning',
  agotado: 'muted',
  expirado: 'destructive',
};

export default async function CuponWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireViewer();
  if (!tienePermiso(viewer, 'cupones.gestionar')) {
    throw new ForbiddenError('Necesitas permiso cupones.gestionar');
  }
  const { id } = await params;
  const [cupon, categorias] = await Promise.all([
    getCupon(id),
    listarCategorias(),
  ]);
  if (!cupon) notFound();

  const usosPct =
    cupon.usos_maximos > 0
      ? Math.min(100, (cupon.usos_actuales / cupon.usos_maximos) * 100)
      : 0;

  return (
    <WorkspaceShell
      accent="marketing"
      header={
        <div className="min-w-0">
          <WorkspaceBreadcrumbs
            items={[
              { label: 'Marketing', href: '/dashboard/marketing' },
              { label: 'Cupones', href: '/dashboard/marketing' },
              { label: cupon.codigo },
            ]}
          />
          <h1 className="mt-1 font-mono text-base font-semibold truncate">{cupon.codigo}</h1>
        </div>
      }
      queue={<MarketingQueue active={{ kind: 'cupon', id: cupon.id }} bucket="cupones_activos" />}
      main={
        <ItemForm
          title={cupon.codigo}
          subtitle={
            cupon.tipo_descuento === 'porcentaje'
              ? `${formatNumero(cupon.valor)}% de descuento`
              : `${formatMoneda(cupon.valor)} de descuento fijo`
          }
          badges={
            <Badge variant={ESTADO_VARIANT[cupon.estado] ?? 'muted'}>{cupon.estado}</Badge>
          }
          meta={
            <span>
              Vigencia {formatFechaLarga(cupon.fecha_inicio)} →{' '}
              {formatFechaLarga(cupon.fecha_expiracion)}
            </span>
          }
          fields={
            <CuponForm
              mode="edit"
              cuponId={cupon.id}
              initial={{
                codigo: cupon.codigo,
                tipo_descuento: cupon.tipo_descuento,
                valor: Number(cupon.valor),
                fecha_inicio: cupon.fecha_inicio,
                fecha_expiracion: cupon.fecha_expiracion,
                usos_maximos: cupon.usos_maximos,
                solo_primera_compra: cupon.solo_primera_compra,
                categoria_id: cupon.categoria_id,
              }}
              categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
              usosActuales={cupon.usos_actuales}
              estado={cupon.estado}
            />
          }
        />
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'uso',
              title: 'Uso',
              children: (
                <div className="space-y-2">
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatNumero(cupon.usos_actuales)}{' '}
                    <span className="text-sm text-muted-foreground">
                      / {formatNumero(cupon.usos_maximos)}
                    </span>
                  </p>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.max(2, usosPct)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {usosPct.toFixed(0)}% usado.
                  </p>
                </div>
              ),
            },
            {
              key: 'segmento',
              title: 'Aplicación',
              children: (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>
                    {cupon.solo_primera_compra
                      ? 'Solo primera compra del cliente'
                      : 'Cualquier compra'}
                  </li>
                  {cupon.categoria_nombre ? (
                    <li>Categoría: {cupon.categoria_nombre}</li>
                  ) : (
                    <li>Sin categoría: aplica a cualquier servicio</li>
                  )}
                </ul>
              ),
            },
            {
              key: 'icon',
              title: 'Tip',
              children: (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Tag size={12} aria-hidden className="mt-0.5 shrink-0" />
                  <span>
                    Para detener un cupón antes de tiempo, baja "usos máximos" al valor
                    actual de "usos actuales" desde el form.
                  </span>
                </p>
              ),
            },
          ]}
        />
      }
    />
  );
}
