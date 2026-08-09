import {
  EnvelopeOpen,
  FileMagnifyingGlass,
  IdentificationCard,
  UserPlus,
} from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { QueueItem, WorkQueue, type QueueTab } from '@/components/workspace';
import { formatFechaHora } from '@/lib/dashboard/format';
import {
  getRRHHQueueCounts,
  listarColaRRHH,
  type RRHHBucket,
} from '@/lib/dashboard/queries/rrhh-workspace';

interface Props {
  viewerId: string;
  active: { kind: 'ninguno' | 'documento' | 'invitacion' | 'prestador'; id?: string };
  bucket?: RRHHBucket;
}

const BADGE_TONE: Record<string, 'success' | 'warning' | 'destructive' | 'info' | 'muted'> = {
  Pendiente: 'warning',
  Aprobado: 'success',
  Rechazado: 'destructive',
  Activa: 'info',
};

export async function RRHHQueue({ viewerId, active, bucket = 'docs_pendientes' }: Props) {
  const [counts, items] = await Promise.all([
    getRRHHQueueCounts(viewerId),
    listarColaRRHH(viewerId, bucket, 30),
  ]);

  const tabs: QueueTab[] = [
    {
      key: 'docs_pendientes',
      label: 'Docs por revisar',
      count: counts.docs_pendientes,
      icon: FileMagnifyingGlass,
      href: '/dashboard/rrhh?bucket=docs_pendientes',
    },
    {
      key: 'invitaciones',
      label: 'Invitaciones activas',
      count: counts.invitaciones_activas,
      icon: EnvelopeOpen,
      href: '/dashboard/rrhh?bucket=invitaciones',
    },
    {
      key: 'sin_documentar',
      label: 'Sin documentar',
      count: counts.sin_documentar,
      icon: IdentificationCard,
      href: '/dashboard/rrhh?bucket=sin_documentar',
    },
    {
      key: 'aprobados_recientes',
      label: 'Aprobados hoy (mis)',
      count: counts.aprobaciones_hoy,
      icon: UserPlus,
      href: '/dashboard/rrhh?bucket=aprobados_recientes',
    },
  ];

  function hrefFor(item: { kind: string; id: string }): string {
    if (item.kind === 'documento') return `/dashboard/rrhh/documento/${item.id}`;
    if (item.kind === 'invitacion') return `/dashboard/rrhh/invitacion/${item.id}`;
    return `/dashboard/prestadores/${item.id}`;
  }

  return (
    <WorkQueue title="RRHH / Onboarding" tabs={tabs} activeKey={bucket}>
      {items.length === 0 ? (
        <p className="px-2 py-3 text-xs text-muted-foreground">
          {bucket === 'docs_pendientes'
            ? 'No hay documentos esperando revisión'
            : bucket === 'invitaciones'
              ? 'Sin invitaciones activas'
              : bucket === 'sin_documentar'
                ? 'Todos los prestadores tienen al menos un documento aprobado'
                : 'No has aprobado/rechazado documentos hoy'}
        </p>
      ) : (
        items.map((item) => (
          <QueueItem
            key={`${item.kind}-${item.id}`}
            href={hrefFor(item)}
            active={active.kind === item.kind && active.id === item.id}
            title={item.primary}
            subtitle={item.secondary}
            meta={`${formatFechaHora(item.ts)}${item.meta ? ' · ' + item.meta : ''}`}
            badge={
              item.badge ? (
                <Badge variant={BADGE_TONE[item.badge] ?? 'muted'}>{item.badge}</Badge>
              ) : null
            }
          />
        ))
      )}
    </WorkQueue>
  );
}
