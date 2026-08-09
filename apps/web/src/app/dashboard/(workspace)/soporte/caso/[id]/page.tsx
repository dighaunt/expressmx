import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowSquareOut,
  Envelope,
  Phone,
  ShieldWarning,
  UserCircle,
} from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { CancelarOrdenForm } from '@/components/dashboard/cancelar-orden-form';
import { CerrarCasoForm } from '@/components/dashboard/cerrar-caso-form';
import { ForzarPasswordForm } from '@/components/dashboard/forzar-password-form';
import { SoporteQueue } from '@/components/dashboard/soporte-queue';
import {
  ActivityEntry,
  ContextSidebar,
  Customer360Card,
  ItemForm,
  SLATimer,
  TierBadge,
  WorkspaceBreadcrumbs,
  WorkspaceShell,
} from '@/components/workspace';
import { ForbiddenError } from '@/lib/errors/http-errors';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { formatFechaHora, formatFechaLarga, formatMoneda } from '@/lib/dashboard/format';
import { getCasoDetalle } from '@/lib/dashboard/queries/casos-detalle';
import {
  getActivityFeed,
  getCustomerHealth,
  getHistorialTicketsCliente,
  getOrdenesRecientesDeCliente,
} from '@/lib/dashboard/queries/soporte-workspace';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Caso · Soporte · ExpressMX' };

export default async function CasoWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePermiso('soporte.abrir_caso');
  const { id } = await params;
  const caso = await getCasoDetalle(id);
  if (!caso) notFound();
  if (caso.agente_id !== viewer.userId) {
    throw new ForbiddenError('Este caso pertenece a otro agente');
  }

  const [actividad, ordenes, customerHealth, historialTickets] = await Promise.all([
    getActivityFeed({
      casoId: caso.id,
      ...(caso.ticket_id ? { ticketId: caso.ticket_id } : {}),
    }),
    getOrdenesRecientesDeCliente(caso.cliente_id, 5),
    getCustomerHealth(caso.cliente_id),
    getHistorialTicketsCliente(caso.cliente_id, 10),
  ]);

  const cerrado = Boolean(caso.cerrado_en);
  const expirado = !cerrado && new Date(caso.expira_en).getTime() < Date.now();
  const activo = !cerrado && !expirado;

  const puedeCancelar = tienePermiso(viewer, 'ordenes.cancelar');
  const puedeForzarPassword = tienePermiso(viewer, 'usuarios.cambiar_password');
  const puedeRestringir = tienePermiso(viewer, 'usuarios.editar');

  const nombreCompleto = `${caso.cliente_nombre} ${caso.cliente_apellidos}`;

  return (
    <WorkspaceShell
      accent="soporte"
      header={
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <WorkspaceBreadcrumbs
              items={[
                { label: 'Soporte', href: '/dashboard/soporte' },
                { label: 'Casos', href: '/dashboard/soporte?bucket=casos' },
                { label: `Caso #${caso.id.slice(0, 8)}` },
              ]}
            />
            <h1 className="mt-1 text-base font-semibold truncate">{nombreCompleto}</h1>
          </div>
          {activo ? <SLATimer expiresAt={caso.expira_en} label="Caso" /> : null}
        </div>
      }
      queue={
        <SoporteQueue viewer={viewer} active={{ kind: 'caso', id: caso.id }} bucket="casos" />
      }
      main={
        <ItemForm
          title={nombreCompleto}
          subtitle={`Caso #${caso.id.slice(0, 8)} · abierto ${formatFechaHora(caso.abierto_en)}`}
          badges={
            cerrado ? (
              <Badge variant="muted">Cerrado</Badge>
            ) : expirado ? (
              <Badge variant="warning">Expirado</Badge>
            ) : (
              <Badge variant="success">Activo</Badge>
            )
          }
          meta={
            cerrado ? (
              <span>Cerrado {formatFechaLarga(caso.cerrado_en!)} · {caso.motivo_cierre}</span>
            ) : (
              <span>
                Expira el {formatFechaHora(caso.expira_en)}. Al expirar pierdes el scope y
                tendrás que solicitar otro PIN.
              </span>
            )
          }
          fields={
            activo ? (
              <div className="space-y-3">
                <p className="text-sm">
                  Tienes acceso al perfil completo del cliente, sus órdenes y las acciones
                  habilitadas para tu rol mientras el caso esté abierto.
                </p>
                <CerrarCasoForm casoId={caso.id} />
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                Este caso ya no está activo. Si necesitas seguir atendiendo al cliente, abre
                uno nuevo con un PIN fresco.
              </div>
            )
          }
          activity={
            actividad.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                Sin actividad. Cualquier acción que ejecutes en el sidebar quedará aquí.
              </p>
            ) : (
              <div className="space-y-2">
                {actividad.map((a, i) => (
                  <ActivityEntry
                    key={`${a.source}-${i}`}
                    time={formatFechaHora(a.ts)}
                    author={a.author}
                    authorTone={a.authorTone}
                    content={
                      a.source === 'audit' ? (
                        <code className="font-mono text-xs">{a.content}</code>
                      ) : (
                        <span className="whitespace-pre-wrap">{a.content}</span>
                      )
                    }
                    small={a.small}
                  />
                ))}
              </div>
            )
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
                    <p className="font-medium text-sm">{nombreCompleto}</p>
                  </div>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Envelope size={12} aria-hidden /> {caso.cliente_email}
                  </p>
                  {caso.cliente_telefono ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone size={12} aria-hidden /> {caso.cliente_telefono}
                    </p>
                  ) : null}
                  {caso.ticket_id ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Link
                        href={`/dashboard/soporte/ticket/${caso.ticket_id}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Ticket vinculado <ArrowSquareOut size={12} aria-hidden />
                      </Link>
                      {caso.ticket_tier_actual ? (
                        <TierBadge tier={caso.ticket_tier_actual} />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'customer360',
              title: 'Customer 360',
              children: (
                <Customer360Card
                  health={customerHealth}
                  historial={historialTickets}
                />
              ),
            },
            {
              key: 'ordenes',
              title: 'Órdenes recientes',
              children:
                ordenes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin órdenes registradas.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {ordenes.map((o) => (
                      <li
                        key={o.id}
                        className="rounded-md border border-border bg-background p-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{o.servicio_nombre}</span>
                          <span className="tabular-nums">{formatMoneda(o.monto_total, true)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-muted-foreground">
                          <span>{o.estatus}</span>
                          <Link
                            href={`/dashboard/ordenes/${o.id}`}
                            className="inline-flex items-center gap-0.5 hover:text-primary"
                          >
                            <ArrowSquareOut size={10} aria-hidden /> ver
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                ),
            },
            {
              key: 'acciones',
              title: 'Acciones del agente',
              children: activo ? (
                <div className="space-y-2">
                  {puedeForzarPassword ? <ForzarPasswordForm casoId={caso.id} /> : null}
                  {puedeCancelar
                    ? ordenes
                        .filter((o) => o.estatus === 'solicitada' || o.estatus === 'asignada')
                        .slice(0, 3)
                        .map((o) => (
                          <CancelarOrdenForm
                            key={o.id}
                            ordenId={o.id}
                            casoId={caso.id}
                            resumen={`${o.servicio_nombre} ${formatMoneda(o.monto_total, true)}`}
                          />
                        ))
                    : null}
                  {puedeRestringir ? (
                    <Link
                      href={`/dashboard/clientes/${caso.cliente_id}`}
                      className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-left text-sm font-medium hover:bg-muted"
                    >
                      <ShieldWarning size={14} aria-hidden />
                      <span className="flex-1">Restringir cuenta</span>
                      <ArrowSquareOut size={12} aria-hidden className="text-muted-foreground" />
                    </Link>
                  ) : null}
                  {!puedeCancelar && !puedeForzarPassword && !puedeRestringir ? (
                    <p className="text-[11px] text-muted-foreground">
                      Tu rol no incluye acciones contextuales para este caso.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Las acciones se desbloquean cuando el caso está activo.
                </p>
              ),
            },
          ]}
        />
      }
    />
  );
}
