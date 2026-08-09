import {
  Bank,
  CurrencyCircleDollar,
  Receipt,
  UserCircle,
} from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { QueueItem, WorkQueue, type QueueTab } from '@/components/workspace';
import { formatFechaHora, formatMoneda } from '@/lib/dashboard/format';
import {
  getFinanzasQueueCounts,
  listarColaFinanzas,
  type FinanzasBucket,
} from '@/lib/dashboard/queries/finanzas-workspace';

interface Props {
  viewerId: string;
  active: { kind: 'ninguno' | 'reembolso' | 'corte' | 'factura'; id?: string };
  bucket?: FinanzasBucket;
}

const ESTATUS_TONE: Record<string, 'success' | 'warning' | 'destructive' | 'info' | 'muted'> = {
  solicitado: 'warning',
  aprobado: 'info',
  procesado: 'success',
  rechazado: 'destructive',
  generado: 'warning',
  revisado: 'info',
  depositado: 'success',
  timbrada: 'success',
  cancelada: 'destructive',
};

export async function FinanzasQueue({ viewerId, active, bucket = 'reembolsos_pendientes' }: Props) {
  const [counts, items] = await Promise.all([
    getFinanzasQueueCounts(viewerId),
    listarColaFinanzas(viewerId, bucket, 30),
  ]);

  const tabs: QueueTab[] = [
    {
      key: 'reembolsos_pendientes',
      label: 'Reembolsos por aprobar',
      count: counts.reembolsos_pendientes,
      icon: CurrencyCircleDollar,
      href: '/dashboard/finanzas?bucket=reembolsos_pendientes',
    },
    {
      key: 'reembolsos_por_procesar',
      label: 'Por procesar',
      count: counts.reembolsos_por_procesar,
      icon: CurrencyCircleDollar,
      href: '/dashboard/finanzas?bucket=reembolsos_por_procesar',
    },
    {
      key: 'reembolsos_recientes',
      label: 'Procesados 14d',
      count: counts.reembolsos_recientes,
      icon: CurrencyCircleDollar,
      href: '/dashboard/finanzas?bucket=reembolsos_recientes',
    },
    {
      key: 'cortes_por_revisar',
      label: 'Cortes por revisar',
      count: counts.cortes_por_revisar,
      icon: Bank,
      href: '/dashboard/finanzas?bucket=cortes_por_revisar',
    },
    {
      key: 'cortes_por_depositar',
      label: 'Cortes por depositar',
      count: counts.cortes_por_depositar,
      icon: Bank,
      href: '/dashboard/finanzas?bucket=cortes_por_depositar',
    },
    {
      key: 'facturas',
      label: 'Facturas',
      count: counts.facturas_hoy,
      icon: Receipt,
      href: '/dashboard/finanzas?bucket=facturas',
    },
    {
      key: 'mias',
      label: 'Mis aprobaciones',
      count: counts.mias,
      icon: UserCircle,
      href: '/dashboard/finanzas?bucket=mias',
    },
  ];

  function hrefFor(item: { kind: string; id: string }): string {
    return `/dashboard/finanzas/${item.kind}/${item.id}`;
  }

  return (
    <WorkQueue title="Cola financiera" tabs={tabs} activeKey={bucket}>
      {items.length === 0 ? (
        <p className="px-2 py-3 text-xs text-muted-foreground">
          Cola vacía. Buen trabajo.
        </p>
      ) : (
        items.map((item) => (
          <QueueItem
            key={`${item.kind}-${item.id}`}
            href={hrefFor(item)}
            active={active.kind === item.kind && active.id === item.id}
            title={item.primary}
            subtitle={item.secondary}
            meta={`${formatFechaHora(item.ts)} · ${item.meta}`.replace(/ · $/, '')}
            badge={
              <span className="flex flex-col items-end gap-0.5">
                <span className="text-xs font-semibold tabular-nums">
                  {formatMoneda(item.monto, true)}
                </span>
                <Badge variant={ESTATUS_TONE[item.estatus] ?? 'muted'}>
                  {item.estatus}
                </Badge>
              </span>
            }
          />
        ))
      )}
    </WorkQueue>
  );
}
