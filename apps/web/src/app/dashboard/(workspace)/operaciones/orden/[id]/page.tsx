import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  Envelope,
  MapPin,
  Phone,
  UserCircle,
  UsersThree,
} from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { AsignarPrestadorForm } from '@/components/dashboard/asignar-prestador-form';
import { CancelarOrdenForm } from '@/components/dashboard/cancelar-orden-form';
import {
  ESTATUS_LABEL,
  OperacionesQueue,
} from '@/components/dashboard/operaciones-queue';
import {
  ContextSidebar,
  ItemForm,
  WorkspaceBreadcrumbs,
  WorkspaceShell,
} from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { formatFechaHora, formatFechaLarga, formatMoneda } from '@/lib/dashboard/format';
import {
  getOrdenDetalle,
  getPrestadoresCercanos,
} from '@/lib/dashboard/queries/operaciones-workspace';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Orden · Operaciones · ExpressMX' };

const ESTATUS_VARIANT: Record<string, 'info' | 'warning' | 'success' | 'destructive' | 'muted'> = {
  solicitada: 'warning',
  asignada: 'info',
  en_camino: 'info',
  en_progreso: 'info',
  completada: 'success',
  cancelada: 'muted',
};

export default async function OrdenWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePermiso('operaciones.ver');
  const { id } = await params;
  const orden = await getOrdenDetalle(id);
  if (!orden) notFound();

  const candidatos =
    orden.estatus === 'completada' || orden.estatus === 'cancelada'
      ? []
      : await getPrestadoresCercanos(orden.id, 8);

  const puedeAsignar = tienePermiso(viewer, 'ordenes.editar');
  const puedeReasignar = tienePermiso(viewer, 'ordenes.reasignar');
  const puedeCancelar = tienePermiso(viewer, 'ordenes.cancelar');

  const direccion = `${orden.direccion_calle} ${orden.direccion_numero_ext}, ${orden.direccion_colonia}, ${orden.direccion_ciudad}`;

  return (
    <WorkspaceShell
      accent="operaciones"
      header={
        <div className="min-w-0">
          <WorkspaceBreadcrumbs
            items={[
              { label: 'Operaciones', href: '/dashboard/operaciones' },
              { label: 'Órdenes', href: '/dashboard/operaciones' },
              { label: `Orden #${orden.id.slice(0, 8)}` },
            ]}
          />
          <h1 className="mt-1 text-base font-semibold truncate">{orden.servicio_nombre}</h1>
        </div>
      }
      queue={
        <OperacionesQueue
          viewerId={viewer.userId}
          active={{ kind: 'orden', id: orden.id }}
          bucket="sin_asignar"
        />
      }
      main={
        <ItemForm
          title={orden.servicio_nombre}
          subtitle={`${orden.categoria_nombre} · #${orden.id.slice(0, 8)}`}
          badges={
            <Badge variant={ESTATUS_VARIANT[orden.estatus] ?? 'muted'}>
              {ESTATUS_LABEL[orden.estatus] ?? orden.estatus}
            </Badge>
          }
          meta={
            <span>
              Programada {formatFechaLarga(orden.fecha_programada)} ·{' '}
              {formatMoneda(orden.monto_total, true)}
              {Number(orden.descuento) > 0 ? (
                <> · descuento {formatMoneda(orden.descuento, true)}</>
              ) : null}
            </span>
          }
          fields={
            <div className="space-y-4 text-sm">
              <Section icon={MapPin} title="Dirección de servicio">
                <p>{direccion}</p>
                {orden.direccion_lat && orden.direccion_lng ? (
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {orden.direccion_lat}, {orden.direccion_lng}
                  </p>
                ) : null}
              </Section>

              <Section icon={UsersThree} title="Prestador">
                {orden.prestador_id ? (
                  <div>
                    <p className="font-medium">{orden.prestador_nombre}</p>
                    <p className="text-xs text-muted-foreground">{orden.prestador_email}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Sin asignar</p>
                )}
              </Section>

              {orden.notas_cliente ? (
                <Section title="Notas del cliente">
                  <p className="whitespace-pre-wrap text-sm">{orden.notas_cliente}</p>
                </Section>
              ) : null}

              {orden.notas_prestador ? (
                <Section title="Notas internas">
                  <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                    {orden.notas_prestador}
                  </p>
                </Section>
              ) : null}

              <p className="text-xs text-muted-foreground">
                Creada {formatFechaHora(orden.created_at)} · última actividad{' '}
                {formatFechaHora(orden.updated_at)}
              </p>
            </div>
          }
        />
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'cliente',
              title: 'Cliente',
              children: (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <UserCircle
                      size={18}
                      weight="duotone"
                      className="text-muted-foreground"
                      aria-hidden
                    />
                    <p className="font-medium text-sm">{orden.cliente_nombre}</p>
                  </div>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Envelope size={12} aria-hidden /> {orden.cliente_email}
                  </p>
                  {orden.cliente_telefono ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone size={12} aria-hidden /> {orden.cliente_telefono}
                    </p>
                  ) : null}
                </div>
              ),
            },
            ...(puedeAsignar || puedeReasignar
              ? [
                  {
                    key: 'asignar',
                    title:
                      orden.estatus === 'solicitada' ? 'Asignar prestador' : 'Reasignar prestador',
                    children: (
                      <AsignarPrestadorForm
                        ordenId={orden.id}
                        estatus={orden.estatus}
                        prestadorActualId={orden.prestador_id}
                        candidatos={candidatos}
                        puedeReasignar={puedeReasignar}
                      />
                    ),
                  },
                ]
              : []),
            ...(puedeCancelar
              ? [
                  {
                    key: 'cancelar',
                    title: 'Cancelar orden',
                    children: (
                      <CancelarOrdenForm
                        ordenId={orden.id}
                        resumen={`${orden.servicio_nombre} · ${formatMoneda(orden.monto_total, true)}`}
                      />
                    ),
                  },
                ]
              : []),
            ...(orden.estatus === 'completada' || orden.estatus === 'cancelada'
              ? [
                  {
                    key: 'cerrada',
                    title: 'Orden cerrada',
                    children: (
                      <p className="text-xs text-muted-foreground">
                        Esta orden ya está {orden.estatus}. Sin más acciones disponibles.
                      </p>
                    ),
                  },
                ]
              : []),
          ]}
        />
      }
    />
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon?: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon ? <Icon size={12} aria-hidden /> : null}
        {title}
      </h3>
      <div>{children}</div>
    </div>
  );
}
