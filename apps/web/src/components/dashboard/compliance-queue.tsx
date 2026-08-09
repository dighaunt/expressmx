import { CalendarBlank, ClockCounterClockwise, ShieldWarning, UserCircle } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { QueueItem, WorkQueue, type QueueTab } from '@/components/workspace';
import { formatFechaHora } from '@/lib/dashboard/format';
import {
  getComplianceQueueCounts,
  listarColaCompliance,
  type ComplianceBucket,
} from '@/lib/dashboard/queries/compliance-workspace';

interface Props {
  viewerId: string;
  active: { kind: 'ninguno' | 'evento'; id?: string };
  bucket?: ComplianceBucket;
}

export async function ComplianceQueue({ viewerId, active, bucket = 'eventos_7d' }: Props) {
  const [counts, items] = await Promise.all([
    getComplianceQueueCounts(viewerId),
    listarColaCompliance(viewerId, bucket, {}, 50),
  ]);

  const tabs: QueueTab[] = [
    {
      key: 'eventos_hoy',
      label: 'Eventos hoy',
      count: counts.eventos_hoy,
      icon: CalendarBlank,
      href: '/dashboard/compliance?bucket=eventos_hoy',
    },
    {
      key: 'eventos_7d',
      label: 'Últimos 7 días',
      count: counts.eventos_7d,
      icon: ClockCounterClockwise,
      href: '/dashboard/compliance?bucket=eventos_7d',
    },
    {
      key: 'mis_acciones',
      label: 'Mis acciones hoy',
      count: counts.acciones_propias_hoy,
      icon: UserCircle,
      href: '/dashboard/compliance?bucket=mis_acciones',
    },
    {
      key: 'alertas_sod',
      label: 'Alertas SoD',
      count: counts.alertas_sod,
      icon: ShieldWarning,
      href: '/dashboard/compliance?bucket=alertas_sod',
    },
  ];

  return (
    <WorkQueue title="Compliance" tabs={tabs} activeKey={bucket}>
      {items.length === 0 ? (
        <p className="px-2 py-3 text-xs text-muted-foreground">
          {bucket === 'alertas_sod'
            ? 'Sin alertas SoD detectadas'
            : 'Sin eventos en este filtro'}
        </p>
      ) : (
        items.map((evt) => (
          <QueueItem
            key={evt.id}
            href={`/dashboard/compliance/evento/${evt.id}`}
            active={active.kind === 'evento' && active.id === evt.id}
            title={evt.accion}
            subtitle={evt.admin_nombre || 'Sistema'}
            meta={`${formatFechaHora(evt.created_at)} · ${evt.entidad}`}
            badge={
              evt.alerta ? (
                <Badge variant="destructive">SoD</Badge>
              ) : evt.caso_id ? (
                <Badge variant="info">Caso</Badge>
              ) : evt.ticket_id ? (
                <Badge variant="info">Ticket</Badge>
              ) : null
            }
          />
        ))
      )}
    </WorkQueue>
  );
}
