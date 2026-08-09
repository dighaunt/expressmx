import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  CalendarBlank,
  Envelope,
  Phone,
  ShieldWarning,
} from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/dashboard/page-header';
import { RestrictControls } from '@/components/dashboard/restrict-controls';
import { WorkspaceBreadcrumbs } from '@/components/workspace';
import { requireViewer } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { ForbiddenError } from '@/lib/errors/http-errors';
import { formatFechaCorta, formatFechaLarga, formatNumero } from '@/lib/dashboard/format';
import {
  quitarRestriccionCliente,
  restringirCliente,
} from '@/lib/dashboard/actions/clientes';
import { getCliente } from '@/lib/dashboard/queries/clientes';
import { tieneAccesoAlCliente } from '@/lib/dashboard/queries/soporte';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Cliente · ExpressMX' };

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireViewer();
  const { id } = await params;

  const accesoLibre =
    tienePermiso(viewer, 'usuarios.listar_completo') ||
    tienePermiso(viewer, 'usuarios.ver');
  if (!accesoLibre) {
    const conCaso = await tieneAccesoAlCliente(viewer.userId, id);
    if (!conCaso) {
      throw new ForbiddenError(
        'Para ver este cliente necesitas abrir un caso de soporte con su PIN.',
      );
    }
  }

  const cliente = await getCliente(id);
  if (!cliente) notFound();

  const puedeRestringir = tienePermiso(viewer, 'usuarios.editar');

  return (
    <>
      <WorkspaceBreadcrumbs
        className="mb-3"
        items={[
          { label: 'Clientes', href: '/dashboard/clientes' },
          { label: `${cliente.nombre} ${cliente.apellidos}` },
        ]}
      />

      <PageHeader
        title={`${cliente.nombre} ${cliente.apellidos}`}
        description={cliente.email}
        actions={
          cliente.restringido ? (
            <Badge variant="destructive">Restringido</Badge>
          ) : cliente.activo ? (
            <Badge variant="success">Activo</Badge>
          ) : (
            <Badge variant="muted">Inactivo</Badge>
          )
        }
      />

      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Datos de contacto
          </h2>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <Envelope size={18} className="text-muted-foreground" aria-hidden />
              <span>{cliente.email}</span>
            </li>
            {cliente.telefono ? (
              <li className="flex items-center gap-3">
                <Phone size={18} className="text-muted-foreground" aria-hidden />
                <span>{cliente.telefono}</span>
              </li>
            ) : null}
            <li className="flex items-center gap-3">
              <CalendarBlank size={18} className="text-muted-foreground" aria-hidden />
              <span>Cliente desde {formatFechaLarga(cliente.created_at)}</span>
            </li>
            {cliente.curp ? (
              <li className="flex items-center gap-3 font-mono text-xs">
                <span className="text-muted-foreground">CURP</span>
                <span>{cliente.curp}</span>
              </li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Actividad
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-muted-foreground">Órdenes totales</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {formatNumero(cliente.ordenes_total)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Última orden</dt>
              <dd className="text-sm">
                {cliente.ultima_orden_at ? formatFechaCorta(cliente.ultima_orden_at) : '—'}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {cliente.restringido ? (
        <section className="mb-6 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <ShieldWarning size={20} className="text-destructive" aria-hidden />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-semibold text-destructive">Cuenta restringida</p>
              {cliente.motivo_restriccion ? (
                <p className="text-sm text-muted-foreground">
                  Motivo: {cliente.motivo_restriccion}
                </p>
              ) : null}
              {cliente.restringido_en ? (
                <p className="text-xs text-muted-foreground">
                  Aplicado el {formatFechaLarga(cliente.restringido_en)}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {puedeRestringir ? (
        <RestrictControls
          tone={cliente.restringido ? 'unrestrict' : 'restrict'}
          targetId={cliente.id}
          restringir={restringirCliente}
          quitar={quitarRestriccionCliente}
        />
      ) : null}
    </>
  );
}
