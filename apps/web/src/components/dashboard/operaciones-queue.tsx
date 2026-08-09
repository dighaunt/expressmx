import { Clipboard, Clock, Fire, Suitcase, UserList } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { QueueItem, WorkQueue, type QueueTab } from '@/components/workspace';
import { formatFechaHora, formatMoneda } from '@/lib/dashboard/format';
import {
  getOperacionesQueueCounts,
  listarColaOrdenes,
} from '@/lib/dashboard/queries/operaciones-workspace';

interface Props {
  viewerId: string;
  active: { kind: 'ninguno' | 'orden'; id?: string };
  bucket?: 'sin_asignar' | 'sla_riesgo' | 'en_curso' | 'completadas' | 'mias';
}

const ESTATUS_LABEL: Record<string, string> = {
  solicitada: 'Solicitada',
  asignada: 'Asignada',
  en_camino: 'En camino',
  en_progreso: 'En progreso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export async function OperacionesQueue({ viewerId, active, bucket = 'sin_asignar' }: Props) {
  const [counts, ordenes] = await Promise.all([
    getOperacionesQueueCounts(viewerId),
    listarColaOrdenes(viewerId, bucket, 30),
  ]);

  const tabs: QueueTab[] = [
    {
      key: 'sin_asignar',
      label: 'Sin asignar',
      count: counts.sin_asignar,
      icon: UserList,
      href: '/dashboard/operaciones?bucket=sin_asignar',
    },
    {
      key: 'sla_riesgo',
      label: 'En riesgo SLA',
      count: counts.en_riesgo_sla,
      icon: Fire,
      href: '/dashboard/operaciones?bucket=sla_riesgo',
    },
    {
      key: 'en_curso',
      label: 'En curso',
      count: counts.en_curso,
      icon: Clock,
      href: '/dashboard/operaciones?bucket=en_curso',
    },
    {
      key: 'mias',
      label: 'Mis asignaciones',
      count: counts.mis_asignaciones,
      icon: Suitcase,
      href: '/dashboard/operaciones?bucket=mias',
    },
    {
      key: 'completadas',
      label: 'Completadas hoy',
      count: counts.completadas_hoy,
      icon: Clipboard,
      href: '/dashboard/operaciones?bucket=completadas',
    },
  ];

  return (
    <WorkQueue title="Cola de órdenes" tabs={tabs} activeKey={bucket}>
      {ordenes.map((o) => {
        const espera = o.espera_minutos > 60
          ? `${Math.floor(o.espera_minutos / 60)}h ${o.espera_minutos % 60}m`
          : `${o.espera_minutos}m`;

        return (
          <QueueItem
            key={o.id}
            href={`/dashboard/operaciones/orden/${o.id}`}
            active={active.kind === 'orden' && active.id === o.id}
            title={o.servicio_nombre}
            subtitle={o.cliente_nombre}
            meta={
              o.estatus === 'solicitada'
                ? `Esperando ${espera}`
                : o.estatus === 'completada'
                  ? formatFechaHora(o.fecha_programada)
                  : `${formatFechaHora(o.fecha_programada)}${o.prestador_nombre ? ' · ' + o.prestador_nombre : ''}`
            }
            badge={
              o.estatus === 'solicitada' && o.espera_minutos > 30 ? (
                <Badge variant="destructive">SLA</Badge>
              ) : (
                <Badge variant="muted">{formatMoneda(o.monto_total, true)}</Badge>
              )
            }
          />
        );
      })}
      {ordenes.length === 0 ? (
        <p className="px-2 py-3 text-xs text-muted-foreground">
          {bucket === 'sin_asignar'
            ? 'No hay órdenes esperando asignación'
            : bucket === 'sla_riesgo'
              ? 'Sin órdenes en riesgo SLA'
              : bucket === 'en_curso'
                ? 'Nada en curso ahora mismo'
                : bucket === 'mias'
                  ? 'No tienes órdenes asignadas'
                  : 'Sin completadas hoy'}
        </p>
      ) : null}
    </WorkQueue>
  );
}

export { ESTATUS_LABEL };
