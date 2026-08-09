import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowSquareOut, Envelope, Phone, UserCircle } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { AbrirCasoTicketForm } from '@/components/dashboard/abrir-caso-form';
import { CancelarOrdenForm } from '@/components/dashboard/cancelar-orden-form';
import {
  ESTATUS_LABEL,
  PRIORIDAD_LABEL,
  SoporteQueue,
  ticketEstatusVariant,
} from '@/components/dashboard/soporte-queue';
import { TicketCierreForm } from '@/components/dashboard/ticket-cierre-form';
import { TicketRealtimeRefresh } from '@/components/dashboard/ticket-realtime-refresh';
import { TicketWorkspaceForm } from '@/components/dashboard/ticket-workspace-form';
import {
  ActionBar,
  ActivityEntry,
  ApprovalsPanel,
  ContextSidebar,
  Customer360Card,
  EscalationDialog,
  ItemForm,
  KbSuggestionPanel,
  PlaybookStrip,
  RemindersPanel,
  SlaBadge,
  SpecialHandlingBanner,
  SupportTriagePanel,
  TicketMimPanel,
  TicketWatchersPanel,
  TasksPanel,
  TierBadge,
  TipoBadge,
  WorkspaceBreadcrumbs,
  WorkspaceShell,
} from '@/components/workspace';
import { buildPlaybook, getPlaybookNextActions } from '@/lib/dashboard/playbooks';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tieneAlgunPermiso, tienePermiso } from '@/lib/dashboard/rbac';
import {
  CATEGORIA_LABEL,
  CODIGO_RESOLUCION_LABEL,
  ESCALATION_MOTIVO_LABEL,
  TIER_LABEL,
} from '@/lib/dashboard/tickets-shared';
import { formatFechaHora, formatMoneda } from '@/lib/dashboard/format';
import {
  getActivityFeed,
  getCustomerHealth,
  getEscalationLog,
  getHistorialTicketsCliente,
  getOrdenesRecientesDeCliente,
  getTicketDetalle,
  type SoporteBucket,
} from '@/lib/dashboard/queries/soporte-workspace';
import { getTicketSlaState } from '@/lib/dashboard/queries/sla';
import { listCannedResponses } from '@/lib/dashboard/queries/canned';
import { listarTareasPorTicket } from '@/lib/dashboard/queries/tareas';
import { listarAprobacionesPorTicket } from '@/lib/dashboard/queries/aprobaciones';
import { anotacionesActivasPorCliente } from '@/lib/dashboard/queries/anotaciones';
import { getSaldoCliente, listarMovimientos } from '@/lib/dashboard/queries/saldo-cliente';
import { getSuspensionActiva } from '@/lib/dashboard/queries/suspensiones';
import {
  getCapCreditoServicio,
  getUmbralesRemediation,
  listarFacturasDelCliente,
  listarPagosDelCliente,
} from '@/lib/dashboard/queries/remediation-data';
import { recordatoriosPendientesPorTicket } from '@/lib/dashboard/queries/recordatorios';
import { getVerificacionActivaByTicket } from '@/lib/dashboard/queries/identidad-verificada';
import { listarWatchers } from '@/lib/dashboard/queries/watchers';
import { listarMimActivos, ticketEstaVinculadoAMim } from '@/lib/dashboard/queries/mim';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Ticket · Soporte · ExpressMX' };

export default async function TicketWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePermiso('soporte.abrir_caso');
  const { id } = await params;
  const ticket = await getTicketDetalle(id);
  if (!ticket) notFound();

  const [
    actividad,
    ordenes,
    escalations,
    slaState,
    cannedResponses,
    customerHealth,
    historialTickets,
    tareas,
    aprobaciones,
    anotaciones,
    saldo,
    movimientos,
    suspension,
    pagosCliente,
    facturasCliente,
    umbrales,
    recordatorios,
    capCredito,
    verificacionIdentidad,
    watchers,
    mimActivos,
    mimVinculado,
  ] = await Promise.all([
    getActivityFeed({ ticketId: ticket.id }),
    getOrdenesRecientesDeCliente(ticket.cliente_id, 5),
    getEscalationLog(ticket.id),
    getTicketSlaState(ticket.id),
    listCannedResponses({ categoria: ticket.categoria, tipo: ticket.tipo, limit: 50 }),
    getCustomerHealth(ticket.cliente_id),
    getHistorialTicketsCliente(ticket.cliente_id, 10),
    listarTareasPorTicket(ticket.id),
    listarAprobacionesPorTicket(ticket.id),
    anotacionesActivasPorCliente(ticket.cliente_id),
    getSaldoCliente(ticket.cliente_id),
    listarMovimientos(ticket.cliente_id, 10),
    getSuspensionActiva(ticket.cliente_id),
    listarPagosDelCliente(ticket.cliente_id, 10),
    listarFacturasDelCliente(ticket.cliente_id, 10),
    getUmbralesRemediation(),
    recordatoriosPendientesPorTicket(id),
    getCapCreditoServicio(ticket.id, ticket.orden_id),
    getVerificacionActivaByTicket(ticket.id),
    listarWatchers(ticket.id),
    listarMimActivos(),
    ticketEstaVinculadoAMim(ticket.id),
  ]);

  const cannedContext = {
    cliente: { nombre: ticket.cliente_nombre },
    orden: ticket.orden_id ? { id: ticket.orden_id } : undefined,
    agente: { nombre: `${viewer.nombre} ${viewer.apellidos}`.trim() },
    ticket: { id: ticket.id },
  };

  const puedeCancelar = tienePermiso(viewer, 'ordenes.cancelar');
  const puedeEscalarL2 = tienePermiso(viewer, 'soporte.tickets.escalar_l2');
  const puedeEscalarL3 = tienePermiso(viewer, 'soporte.tickets.escalar_l3');
  const puedeCerrar = tienePermiso(viewer, 'soporte.tickets.cerrar');
  const puedeGestionarParticipantes = tieneAlgunPermiso(viewer, [
    'tickets.gestionar',
    'soporte.tarea.crear',
    'soporte.mim.declarar',
  ]);
  const puedeVincularMim = tienePermiso(viewer, 'soporte.mim.declarar');
  const permisosRemediation = {
    crearTarea: tienePermiso(viewer, 'soporte.tarea.crear'),
    solicitarReembolso: tienePermiso(viewer, 'soporte.reembolso.solicitar_inline'),
    aprobarReembolsoExpress: tienePermiso(viewer, 'soporte.reembolso.aprobar_express'),
    investigarPago: tienePermiso(viewer, 'soporte.pago.investigar'),
    aplicarCredito: tienePermiso(viewer, 'soporte.credito.aplicar'),
    aplicarCreditoSinAprobacion: tienePermiso(
      viewer,
      'soporte.credito.aplicar_sin_aprobacion',
    ),
    suspenderCuenta: tienePermiso(viewer, 'soporte.suspender_cuenta'),
    reactivarCuenta: tienePermiso(viewer, 'soporte.reactivar_cuenta'),
    reasignarPrestador: tienePermiso(viewer, 'ordenes.reasignar') || tienePermiso(viewer, 'soporte.tarea.crear'),
    cancelarCfdi: tienePermiso(viewer, 'soporte.cfdi.solicitar_cancelacion'),
    programarRecordatorio: tienePermiso(viewer, 'soporte.recordatorio.crear'),
  };
  const puedeCrearTarea = permisosRemediation.crearTarea;
  const ticketCerrado = ticket.estatus === 'resuelto';

  const notasInternasCount = actividad.filter(
    (a) => a.source === 'mensaje' && a.esInterno === true,
  ).length;
  const notasPublicasCount = actividad.filter(
    (a) => a.source === 'mensaje' && a.authorTone === 'agent' && a.esInterno !== true,
  ).length;
  const reembolsosProcesados = pagosCliente.filter((p) => p.estatus === 'reembolsado').length;

  const playbook = buildPlaybook({
    ticketId: ticket.id,
    ticketEstatus: ticket.estatus,
    ticketTipo: ticket.tipo,
    categoria: ticket.categoria as import('@/lib/dashboard/tickets-shared').CategoriaTicket,
    tieneOrden: !!ticket.orden_id,
    hayPagoProcesado: pagosCliente.some((p) => p.estatus === 'procesado'),
    cerrado: ticketCerrado,
    resolucionCodigo: ticket.resolucion_codigo ?? null,
    tareas,
    aprobaciones,
    movimientos,
    notasInternasCount,
    notasPublicasCount,
    reembolsosProcesados,
  });
  const playbookActions = getPlaybookNextActions(playbook);
  const activeQueueBucket: SoporteBucket =
    ticket.estatus === 'resuelto'
      ? 'resueltos'
      : ticket.agente_id === viewer.userId
        ? 'mis'
        : ticket.agente_id
          ? 'equipo'
          : 'sin_asignar';
  const codigoResolucionLabel =
    ticket.resolucion_codigo && ticket.resolucion_codigo in CODIGO_RESOLUCION_LABEL
      ? CODIGO_RESOLUCION_LABEL[ticket.resolucion_codigo]
      : null;

  return (
    <WorkspaceShell
      accent="soporte"
      header={
        <div className="min-w-0 space-y-2">
          <WorkspaceBreadcrumbs
            items={[
              { label: 'Soporte', href: '/dashboard/soporte' },
              { label: 'Tickets', href: '/dashboard/soporte' },
              { label: `#${ticket.id.slice(0, 8).toUpperCase()}` },
            ]}
          />
          <h1 className="text-base font-semibold truncate">{ticket.asunto}</h1>
          <SpecialHandlingBanner anotaciones={anotaciones} />
          <PlaybookStrip playbook={playbook} actions={playbookActions} />
        </div>
      }
      queue={
        <SoporteQueue
          viewer={viewer}
          active={{ kind: 'ticket', id: ticket.id }}
          bucket={activeQueueBucket}
        />
      }
      main={
        <div className="space-y-6">
          <TicketRealtimeRefresh ticketId={ticket.id} />
          <SupportTriagePanel
            ticket={ticket}
            actividad={actividad}
            ordenes={ordenes}
            pagos={pagosCliente}
            facturas={facturasCliente}
            historial={historialTickets.filter((h) => h.id !== ticket.id)}
            tareas={tareas}
            aprobaciones={aprobaciones}
            escalations={escalations}
            customerHealth={customerHealth}
            slaState={slaState}
            verificacionIdentidad={verificacionIdentidad}
            mimVinculado={mimVinculado}
            watchersCount={watchers.length}
          />
          <div id="ticket-conversation" className="scroll-mt-28">
            <ItemForm
              title={ticket.asunto}
              subtitle={`${CATEGORIA_LABEL[ticket.categoria as keyof typeof CATEGORIA_LABEL] ?? ticket.categoria} · #${ticket.id.slice(0, 8)}`}
              badges={
                <>
                  <TipoBadge tipo={ticket.tipo} />
                  <TierBadge tier={ticket.tier_actual} />
                  <Badge variant={ticketEstatusVariant(ticket.estatus)}>
                    {ESTATUS_LABEL[ticket.estatus]}
                  </Badge>
                  <Badge variant="outline">{PRIORIDAD_LABEL[ticket.prioridad]}</Badge>
                </>
              }
              meta={
                <div className="space-y-2">
                  <span>
                    Creado {formatFechaHora(ticket.created_at)} · última actividad{' '}
                    {formatFechaHora(ticket.updated_at)}
                    {ticket.agente_nombre ? ` · agente: ${ticket.agente_nombre}` : ' · sin asignar'}
                    {ticket.grupo_asignado ? ` · grupo: ${ticket.grupo_asignado}` : ''}
                  </span>
                  {ticketCerrado && ticket.cerrado_at ? (
                    <span className="block text-success">
                      Cerrado el {formatFechaHora(ticket.cerrado_at)}
                      {codigoResolucionLabel ? ` · ${codigoResolucionLabel}` : ''}
                      {ticket.cerrado_por_nombre ? ` · por ${ticket.cerrado_por_nombre}` : ''}
                    </span>
                  ) : null}
                  {ticketCerrado && ticket.resolucion_notas ? (
                    <blockquote className="block whitespace-pre-wrap rounded-md border-l-2 border-success/50 bg-success/5 px-3 py-2 text-sm text-foreground">
                      {ticket.resolucion_notas}
                    </blockquote>
                  ) : null}
                </div>
              }
              fields={
                <TicketWorkspaceForm
                  ticketId={ticket.id}
                  estatus={ticket.estatus}
                  prioridad={ticket.prioridad}
                  agenteId={ticket.agente_id}
                  viewerId={viewer.userId}
                  cannedResponses={cannedResponses}
                  cannedContext={cannedContext}
                />
              }
              activity={
                actividad.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                    Sin mensajes. Envía la primera respuesta desde arriba.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {actividad.map((a, i) => (
                      <ActivityEntry
                        key={`${a.source}-${i}`}
                        time={formatFechaHora(a.ts)}
                        author={a.author}
                        authorTone={a.authorTone}
                        esInterno={a.esInterno}
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
          </div>
        </div>
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
                    <UserCircle size={18} weight="duotone" className="text-muted-foreground" aria-hidden />
                    <p className="font-medium text-sm">{ticket.cliente_nombre}</p>
                  </div>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Envelope size={12} aria-hidden /> {ticket.cliente_email}
                  </p>
                  {ticket.cliente_telefono ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone size={12} aria-hidden /> {ticket.cliente_telefono}
                    </p>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'customer360',
              title: 'Customer 360',
              children: (
                <div className="space-y-3">
                  <Customer360Card
                    health={customerHealth}
                    historial={historialTickets.filter((h) => h.id !== ticket.id)}
                    saldo={saldo}
                    movimientos={movimientos}
                    suspension={suspension}
                    verificacionIdentidad={verificacionIdentidad}
                  />
                  {!verificacionIdentidad && !ticketCerrado ? (
                    <AbrirCasoTicketForm
                      ticketId={ticket.id}
                      clienteEmail={ticket.cliente_email}
                    />
                  ) : null}
                </div>
              ),
            },
            {
              key: 'sla',
              title: 'SLA',
              children: slaState ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Resolución</span>
                    <SlaBadge
                      dueAt={slaState.ttr_due_at}
                      breached={slaState.breached_ttr}
                      resueltoAt={slaState.resuelto_at}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Primera respuesta</span>
                    <SlaBadge
                      dueAt={slaState.frt_due_at}
                      breached={slaState.breached_frt}
                      resueltoAt={slaState.primer_respuesta_at}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sin política asignada</p>
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
              key: 'remediation',
              title: 'Acciones',
              children: (
                <div id="soporte-actions" className="scroll-mt-28">
                  <ActionBar
                    ticketId={ticket.id}
                    clienteId={ticket.cliente_id}
                    categoria={ticket.categoria}
                    ticketCerrado={ticketCerrado}
                    clienteSuspendido={!!suspension}
                    suspensionId={suspension?.id ?? null}
                    pagos={pagosCliente}
                    facturas={facturasCliente}
                    ordenes={ordenes.map((o) => ({
                      id: o.id,
                      estatus: o.estatus,
                      servicio_nombre: o.servicio_nombre,
                    }))}
                    permisos={permisosRemediation}
                    umbrales={umbrales}
                    capCredito={{
                      capServicioMxn: capCredito.capServicioMxn,
                      factorServicio: capCredito.factorServicio,
                    }}
                  />
                </div>
              ),
            },
            {
              key: 'participantes',
              title: `Participantes (${watchers.length})`,
              children: (
                <TicketWatchersPanel
                  ticketId={ticket.id}
                  watchers={watchers}
                  puedeGestionar={puedeGestionarParticipantes}
                />
              ),
            },
            {
              key: 'mim',
              title: 'Major Incident',
              children: (
                <TicketMimPanel
                  ticketId={ticket.id}
                  mimVinculado={mimVinculado}
                  mimActivos={mimActivos}
                  puedeVincular={puedeVincularMim}
                />
              ),
            },
            {
              key: 'tareas',
              title: `Tareas (${tareas.length})`,
              children: (
                <div id="ticket-tasks" className="scroll-mt-28">
                  <TasksPanel tareas={tareas} />
                </div>
              ),
            },
            ...(aprobaciones.length > 0
              ? [
                  {
                    key: 'aprobaciones',
                    title: `Aprobaciones (${aprobaciones.length})`,
                    children: <ApprovalsPanel aprobaciones={aprobaciones} />,
                  },
                ]
              : []),
            {
              key: 'recordatorios',
              title: `Recordatorios (${recordatorios.filter((r) => !r.disparado_at && !r.cancelado_at).length})`,
              children: <RemindersPanel recordatorios={recordatorios} />,
            },
            {
              key: 'kb',
              title: 'Base de conocimiento',
              children: (
                <div id="ticket-kb" className="scroll-mt-28">
                  <KbSuggestionPanel
                    asunto={ticket.asunto}
                    categoria={ticket.categoria}
                    tipo={ticket.tipo}
                    ticketId={ticket.id}
                    playbookStage={playbook.stages.find((s) => s.state === 'active') ?? null}
                  />
                </div>
              ),
            },
            {
              key: 'escalar',
              title: 'Escalación',
              children: (
                <div id="ticket-escalation" className="scroll-mt-28">
                  <EscalationDialog
                    ticketId={ticket.id}
                    tierActual={ticket.tier_actual}
                    puedeEscalarL2={puedeEscalarL2}
                    puedeEscalarL3={puedeEscalarL3}
                  />
                </div>
              ),
            },
            ...(escalations.length > 0
              ? [
                  {
                    key: 'historial-escalacion',
                    title: 'Historial de escalaciones',
                    children: (
                      <ul className="space-y-2">
                        {escalations.map((e) => (
                          <li
                            key={e.id}
                            className="rounded-md border border-border bg-background p-2 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">
                                {TIER_LABEL[e.from_tier]} → {TIER_LABEL[e.to_tier]}
                              </span>
                              <span className="tabular-nums text-muted-foreground">
                                {formatFechaHora(e.ocurrido_at)}
                              </span>
                            </div>
                            <p className="mt-1 text-muted-foreground">
                              {ESCALATION_MOTIVO_LABEL[e.motivo]}
                              {e.from_user_nombre ? ` · por ${e.from_user_nombre}` : ''}
                              {e.to_grupo ? ` · grupo: ${e.to_grupo}` : ''}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-foreground">
                              {e.hipotesis}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ),
                  },
                ]
              : []),
            ...(puedeCerrar && !ticketCerrado
              ? [
                  {
                    key: 'cierre',
                    title: 'Cierre',
                    children: (
                      <div id="ticket-close" className="scroll-mt-28">
                        <TicketCierreForm ticketId={ticket.id} />
                      </div>
                    ),
                  },
                ]
              : []),
            {
              key: 'acciones',
              title: 'Acciones',
              children: (
                <div className="space-y-2">
                  {ticket.orden_id && puedeCancelar ? (
                    <CancelarOrdenForm
                      ordenId={ticket.orden_id}
                      ticketId={ticket.id}
                      resumen="Orden vinculada al ticket"
                    />
                  ) : null}
                  {!ticket.orden_id && puedeCancelar && ordenes.length > 0
                    ? ordenes
                        .filter((o) => o.estatus === 'solicitada' || o.estatus === 'asignada')
                        .slice(0, 3)
                        .map((o) => (
                          <CancelarOrdenForm
                            key={o.id}
                            ordenId={o.id}
                            ticketId={ticket.id}
                            resumen={`${o.servicio_nombre} ${formatMoneda(o.monto_total, true)}`}
                          />
                        ))
                    : null}
                  <p className="text-[11px] text-muted-foreground">
                    Para cambiar password u otras acciones sensibles, valida identidad
                    con el PIN del cliente desde Customer 360.
                  </p>
                </div>
              ),
            },
          ]}
        />
      }
    />
  );
}
