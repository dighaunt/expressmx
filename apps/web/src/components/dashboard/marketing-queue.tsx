import { ImageSquare, Megaphone, Tag, Warning } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { QueueItem, WorkQueue, type QueueTab } from '@/components/workspace';
import { formatFechaHora } from '@/lib/dashboard/format';
import {
  getMarketingQueueCounts,
  listarColaMarketing,
  type MarketingBucket,
} from '@/lib/dashboard/queries/marketing-workspace';

interface Props {
  active: { kind: 'ninguno' | 'cupon' | 'banner'; id?: string };
  bucket?: MarketingBucket;
}

const BADGE_TONE: Record<string, 'success' | 'warning' | 'destructive' | 'info' | 'muted'> = {
  Activo: 'success',
  Vigente: 'success',
  'Por expirar': 'warning',
  Pausado: 'muted',
  'Fuera de vigencia': 'destructive',
};

export async function MarketingQueue({ active, bucket = 'cupones_activos' }: Props) {
  const [counts, items] = await Promise.all([
    getMarketingQueueCounts(),
    listarColaMarketing(bucket, 30),
  ]);

  const tabs: QueueTab[] = [
    {
      key: 'cupones_activos',
      label: 'Cupones activos',
      count: counts.cupones_activos,
      icon: Tag,
      href: '/dashboard/marketing?bucket=cupones_activos',
    },
    {
      key: 'cupones_por_expirar',
      label: 'Por expirar (7d)',
      count: counts.cupones_por_expirar,
      icon: Warning,
      href: '/dashboard/marketing?bucket=cupones_por_expirar',
    },
    {
      key: 'banners_vigentes',
      label: 'Banners vigentes',
      count: counts.banners_vigentes,
      icon: ImageSquare,
      href: '/dashboard/marketing?bucket=banners_vigentes',
    },
    {
      key: 'banners_pausados',
      label: 'Banners pausados',
      count: counts.banners_pausados,
      icon: Megaphone,
      href: '/dashboard/marketing?bucket=banners_pausados',
    },
  ];

  function hrefFor(item: { kind: string; id: string }): string {
    return `/dashboard/marketing/${item.kind}/${item.id}`;
  }

  return (
    <WorkQueue title="Marketing" tabs={tabs} activeKey={bucket}>
      {items.length === 0 ? (
        <p className="px-2 py-3 text-xs text-muted-foreground">
          {bucket === 'cupones_activos'
            ? 'Sin cupones activos. Crea uno desde la vista de cupones.'
            : bucket === 'cupones_por_expirar'
              ? 'Ningún cupón expira pronto'
              : bucket === 'banners_vigentes'
                ? 'Sin banners vigentes ahora mismo'
                : 'Sin banners pausados'}
        </p>
      ) : (
        items.map((item) => (
          <QueueItem
            key={`${item.kind}-${item.id}`}
            href={hrefFor(item)}
            active={active.kind === item.kind && active.id === item.id}
            title={item.primary}
            subtitle={item.secondary}
            meta={`${formatFechaHora(item.ts)} · ${item.meta}`}
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
