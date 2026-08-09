import Link from 'next/link';
import { ChatCircle, Lifebuoy, Tray, UserList } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import {
  QueueItem,
  SlaBadge,
  TierBadge,
  TipoBadge,
  WorkQueue,
  type QueueTab,
} from '@/components/workspace';
import {
  ESTATUS_LABEL,
  PRIORIDAD_LABEL,
  type EstatusTicket,
  type PrioridadTicket,
  type TipoTicket,
} from '@/lib/dashboard/tickets-shared';
import { tienePermiso } from '@/lib/dashboard/rbac';
import type { Viewer } from '@/lib/dashboard/rbac-shared';
import { formatFechaHora } from '@/lib/dashboard/format';
import {
  getSoporteQueueCounts,
  listarColaTickets,
  type QueueTicket,
  type SoporteBucket,
} from '@/lib/dashboard/queries/soporte-workspace';
import {
  getCasoActivoDelAgente,
  listarCasosDelAgente,
} from '@/lib/dashboard/queries/soporte';
import { getSlaStatesByTicketIds } from '@/lib/dashboard/queries/sla';

interface Props {
  viewer: Viewer;
  active: { kind: 'ninguno' | 'abrir' | 'ticket' | 'caso'; id?: string };
  bucket?: SoporteBucket | 'casos';
  tipo?: TipoTicket;
}

const PRIORIDAD_TONE: Record<
  PrioridadTicket,
  'destructive' | 'warning' | 'info' | 'muted'
> = {
  critica: 'destructive',
  alta: 'warning',
  media: 'info',
  baja: 'muted',
};

interface TipoFiltro {
  key: 'todos' | TipoTicket;
  label: string;
  href: string;
  active: boolean;
}

function buildHref(
  bucket: Props['bucket'],
  tipo: TipoTicket | undefined,
): string {
  const params = new URLSearchParams();
  if (bucket && bucket !== 'equipo') params.set('bucket', bucket);
  if (tipo) params.set('tipo', tipo);
  const qs = params.toString();
  return qs ? `/dashboard/soporte?${qs}` : '/dashboard/soporte';
}

export async function SoporteQueue({
  viewer,
  active,
  bucket = 'equipo',
  tipo,
}: Props) {
  const agenteId = viewer.userId;
  const [counts, tickets, casoActivo, casos] = await Promise.all([
    getSoporteQueueCounts(agenteId),
    bucket === 'casos'
      ? Promise.resolve<QueueTicket[]>([])
      : listarColaTickets(agenteId, bucket, 30, tipo),
    getCasoActivoDelAgente(agenteId),
    bucket === 'casos' ? listarCasosDelAgente(agenteId, 30) : Promise.resolve([]),
  ]);

  const slaStates = await getSlaStatesByTicketIds(tickets.map((t) => t.id));

  const sortedTickets = bucket === 'casos'
    ? tickets
    : [...tickets].sort((a, b) => {
        const sa = slaStates.get(a.id);
        const sb = slaStates.get(b.id);
        const aBreached = sa?.breached_ttr && !sa?.resuelto_at ? 0 : 1;
        const bBreached = sb?.breached_ttr && !sb?.resuelto_at ? 0 : 1;
        if (aBreached !== bBreached) return aBreached - bBreached;
        return 0;
      });

  const tabs: QueueTab[] = [
    {
      key: 'equipo',
      label: 'Equipo activo',
      count: counts.equipo_activo,
      icon: Lifebuoy,
      href: buildHref('equipo', tipo),
    },
    {
      key: 'mis',
      label: 'Mis tickets',
      count: counts.mis_tickets,
      icon: Tray,
      href: buildHref('mis', tipo),
    },
    {
      key: 'sin_asignar',
      label: 'Sin asignar',
      count: counts.sin_asignar,
      icon: UserList,
      href: buildHref('sin_asignar', tipo),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      count: counts.acciones_pendientes,
      icon: ChatCircle,
      href: buildHref('acciones', tipo),
    },
    {
      key: 'casos',
      label: 'Casos',
      count: counts.casos_activos,
      icon: UserList,
      href: buildHref('casos', undefined),
    },
    {
      key: 'resueltos',
      label: 'Resueltos 14d',
      count: counts.resueltos_recientes,
      icon: ChatCircle,
      href: buildHref('resueltos', tipo),
    },
  ];

  const puedeVerProblemas = tienePermiso(viewer, 'soporte.problem.ver');
  const tipoFiltros: TipoFiltro[] =
    bucket === 'casos'
      ? []
      : [
          { key: 'todos', label: 'Todos', href: buildHref(bucket, undefined), active: !tipo },
          { key: 'incidente', label: 'Incidentes', href: buildHref(bucket, 'incidente'), active: tipo === 'incidente' },
          { key: 'solicitud', label: 'Solicitudes', href: buildHref(bucket, 'solicitud'), active: tipo === 'solicitud' },
          ...(puedeVerProblemas
            ? [
                {
                  key: 'problema' as const,
                  label: 'Problemas',
                  href: buildHref(bucket, 'problema'),
                  active: tipo === 'problema',
                },
              ]
            : []),
        ];

  return (
    <div className="space-y-4">
      {casoActivo ? (
        <Link
          href={`/dashboard/soporte/caso/${casoActivo.id}`}
          className="block rounded-md border border-success/40 bg-success/5 p-2.5 text-xs"
        >
          <p className="text-[10px] uppercase tracking-wide text-success">Caso activo</p>
          <p className="font-semibold">{casoActivo.cliente_nombre}</p>
          <p className="text-muted-foreground">
            Expira {formatFechaHora(casoActivo.expira_en)}
          </p>
        </Link>
      ) : null}

      <WorkQueue title="Cola" tabs={tabs} activeKey={bucket}>
        {tipoFiltros.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
            {tipoFiltros.map((f) => (
              <Link
                key={f.key}
                href={f.href}
                className={
                  f.active
                    ? 'rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground'
                    : 'rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted'
                }
              >
                {f.label}
              </Link>
            ))}
          </div>
        ) : null}
        {bucket === 'casos'
          ? casos.map((c) => {
              const cerrado = Boolean(c.cerrado_en);
              return (
                <QueueItem
                  key={c.id}
                  href={`/dashboard/soporte/caso/${c.id}`}
                  active={active.kind === 'caso' && active.id === c.id}
                  title={c.cliente_nombre}
                  subtitle={cerrado ? 'Cerrado' : 'Activo'}
                  meta={formatFechaHora(c.abierto_en)}
                  badge={
                    cerrado ? (
                      <Badge variant="muted">Cerrado</Badge>
                    ) : (
                      <Badge variant="success">Activo</Badge>
                    )
                  }
                />
              );
            })
          : sortedTickets.map((t) => {
              const sla = slaStates.get(t.id);
              return (
                <QueueItem
                  key={t.id}
                  href={`/dashboard/soporte/ticket/${t.id}`}
                  active={active.kind === 'ticket' && active.id === t.id}
                  title={t.asunto}
                  subtitle={t.cliente_nombre}
                  meta={formatFechaHora(t.updated_at)}
                  badge={
                    <span className="flex flex-wrap items-center justify-end gap-1">
                      <TipoBadge tipo={t.tipo} />
                      <TierBadge tier={t.tier_actual} />
                      {t.tareas_abiertas > 0 ? (
                        <Badge variant="warning">
                          {t.tareas_abiertas} tarea{t.tareas_abiertas === 1 ? '' : 's'}
                        </Badge>
                      ) : null}
                      {t.action_status && t.action_status !== 'ninguno' ? (
                        <Badge variant="warning">En espera</Badge>
                      ) : null}
                      <Badge variant={PRIORIDAD_TONE[t.prioridad]}>
                        {PRIORIDAD_LABEL[t.prioridad]}
                      </Badge>
                      {sla ? (
                        <SlaBadge
                          dueAt={sla.ttr_due_at}
                          breached={sla.breached_ttr}
                          resueltoAt={sla.resuelto_at}
                          compact
                        />
                      ) : null}
                    </span>
                  }
                />
              );
            })}
        {bucket !== 'casos' && sortedTickets.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            {tipo
              ? `No hay tickets tipo "${tipo}" en esta cola`
              : bucket === 'sin_asignar'
                ? 'No hay tickets esperando agente'
                : bucket === 'acciones'
                  ? 'No hay tickets esperando acciones o tareas de soporte'
                : bucket === 'resueltos'
                  ? 'No hay tickets resueltos recientemente'
                  : bucket === 'mis'
                    ? 'Tu cola está vacía'
                    : 'No hay tickets activos del equipo'}
          </p>
        ) : null}
        {bucket === 'casos' && casos.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            Sin casos. Abre uno con el PIN del cliente.
          </p>
        ) : null}
      </WorkQueue>
    </div>
  );
}

export function ticketEstatusVariant(estatus: EstatusTicket): 'info' | 'warning' | 'success' | 'destructive' {
  if (estatus === 'resuelto') return 'success';
  if (estatus === 'escalado') return 'destructive';
  if (estatus === 'en_revision') return 'warning';
  return 'info';
}

export { ESTATUS_LABEL, PRIORIDAD_LABEL };
