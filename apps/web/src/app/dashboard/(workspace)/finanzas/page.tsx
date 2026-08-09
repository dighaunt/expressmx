import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowSquareOut,
  CurrencyCircleDollar,
  HandCoins,
  Receipt,
  ShieldCheck,
  Stack,
  Warning,
} from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { ContextSidebar, WorkspaceShell, WorkspaceTools } from '@/components/workspace';
import { FinanzasQueue } from '@/components/dashboard/finanzas-queue';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { formatFechaHora, formatMoneda } from '@/lib/dashboard/format';
import {
  getFinanzasQueueCounts,
  listarColaFinanzas,
  listarPagosAnomalos,
  type FinanzasBucket,
} from '@/lib/dashboard/queries/finanzas-workspace';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Finanzas · ExpressMX' };

interface SearchParams {
  bucket?: string;
}

const BUCKETS_VALIDOS = new Set([
  'reembolsos_pendientes',
  'reembolsos_por_procesar',
  'reembolsos_recientes',
  'cortes_por_revisar',
  'cortes_por_depositar',
  'facturas',
  'mias',
]);

export default async function FinanzasHomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requirePermiso('finanzas.ver');
  const sp = await searchParams;
  const bucket = BUCKETS_VALIDOS.has(sp.bucket ?? '')
    ? (sp.bucket as FinanzasBucket)
    : 'reembolsos_pendientes';

  const [counts, pagosAnomalos, reembolsosPendientes] = await Promise.all([
    getFinanzasQueueCounts(viewer.userId),
    listarPagosAnomalos(10),
    listarColaFinanzas(viewer.userId, 'reembolsos_pendientes', 5),
  ]);

  return (
    <WorkspaceShell
      header={
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Workspace
            </p>
            <h1 className="text-base font-semibold">Finanzas</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            {counts.tareas_finanzas} tarea(s) abierta(s) · {counts.facturas_hoy} factura(s) hoy
          </p>
        </div>
      }
      queue={
        <FinanzasQueue
          viewerId={viewer.userId}
          active={{ kind: 'ninguno' }}
          bucket={bucket}
        />
      }
      main={
        <div className="space-y-4">
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Acciones requeridas
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard
                tone={counts.pagos_sin_reconciliar > 0 ? 'warning' : 'neutral'}
                icon={Warning}
                count={counts.pagos_sin_reconciliar}
                label="Pagos sin reconciliar"
                hint="Stripe cobró pero no llegó webhook (≥5 min)"
                href="#pagos-anomalos"
              />
              <KpiCard
                tone={counts.reembolsos_pendientes > 0 ? 'info' : 'neutral'}
                icon={HandCoins}
                count={counts.reembolsos_pendientes}
                label="Reembolsos por aprobar"
                hint="Soporte solicitó, espera tu decisión"
                href="/dashboard/finanzas?bucket=reembolsos_pendientes"
              />
              <KpiCard
                tone={counts.reembolsos_por_procesar > 0 ? 'info' : 'neutral'}
                icon={CurrencyCircleDollar}
                count={counts.reembolsos_por_procesar}
                label="Reembolsos por procesar"
                hint="Aprobados, falta capturar referencia"
                href="/dashboard/finanzas?bucket=reembolsos_por_procesar"
              />
              <KpiCard
                tone={counts.tareas_finanzas > 0 ? 'info' : 'neutral'}
                icon={Stack}
                count={counts.tareas_finanzas}
                label="Tareas en bandeja"
                hint="Investigaciones, CFDI, créditos pendientes"
                href="/dashboard/finanzas/tareas-bandeja"
              />
              <KpiCard
                tone={counts.cortes_por_revisar > 0 ? 'info' : 'neutral'}
                icon={ShieldCheck}
                count={counts.cortes_por_revisar}
                label="Cortes por revisar"
                hint="Liquidaciones a prestadores"
                href="/dashboard/finanzas?bucket=cortes_por_revisar"
              />
              <KpiCard
                tone={counts.cortes_por_depositar > 0 ? 'info' : 'neutral'}
                icon={Receipt}
                count={counts.cortes_por_depositar}
                label="Cortes por depositar"
                hint="Validados, falta SPEI"
                href="/dashboard/finanzas?bucket=cortes_por_depositar"
              />
            </div>
          </section>

          {counts.pagos_fallidos_24h > 0 ? (
            <p className="text-xs text-muted-foreground">
              <Warning size={11} aria-hidden weight="duotone" className="mr-1 inline" />
              {counts.pagos_fallidos_24h} pago(s) fallido(s) en las últimas 24h.
            </p>
          ) : null}

          <section
            id="pagos-anomalos"
            className="overflow-hidden rounded-lg border border-border bg-card"
          >
            <header className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pagos sin reconciliar
              </h2>
              <span className="text-xs text-muted-foreground">
                {pagosAnomalos.length} de {counts.pagos_sin_reconciliar}
              </span>
            </header>
            {pagosAnomalos.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs italic text-muted-foreground">
                Todos los pagos están reconciliados con Stripe. El cron corre cada 5 min.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {pagosAnomalos.map((p) => (
                  <li key={p.pago_id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="warning">{p.estatus}</Badge>
                        <span className="text-xs font-medium">{p.cliente_nombre}</span>
                        <span className="text-[11px] text-muted-foreground">
                          hace {p.minutos_sin_webhook} min
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {p.payment_intent_id ?? 'sin intent'}
                        {p.raw_status ? ` · raw=${p.raw_status}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-semibold tabular-nums">
                        {formatMoneda(p.monto, true)}
                      </span>
                      <Link
                        href={`/dashboard/ordenes/${p.orden_id}`}
                        className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
                      >
                        Ver orden <ArrowSquareOut size={10} aria-hidden />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <header className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Reembolsos por aprobar (top 5)
              </h2>
              <Link
                href="/dashboard/finanzas?bucket=reembolsos_pendientes"
                className="text-[11px] text-primary hover:underline"
              >
                Ver todos
              </Link>
            </header>
            {reembolsosPendientes.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs italic text-muted-foreground">
                Sin reembolsos por aprobar. Vienen vía soporte cuando exceden el umbral express.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {reembolsosPendientes.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{r.primary}</p>
                      <p className="text-xs text-muted-foreground">{r.secondary}</p>
                      <p className="text-[11px] text-muted-foreground">{r.meta}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-semibold tabular-nums">
                        {formatMoneda(r.monto, true)}
                      </span>
                      <Link
                        href={`/dashboard/finanzas/reembolso/${r.id}`}
                        className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
                      >
                        Revisar <ArrowSquareOut size={10} aria-hidden />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'herramientas',
              title: 'Herramientas financieras',
              children: <WorkspaceTools viewer={viewer} groups={['finanzas']} compact />,
            },
            {
              key: 'sod',
              title: 'Segregation of Duties',
              children: (
                <p className="text-xs text-muted-foreground">
                  Quien aprueba un reembolso <strong>no puede</strong> ser quien lo
                  marca como procesado. Necesitas otro miembro del equipo para la
                  segunda firma.
                </p>
              ),
            },
            {
              key: 'flujo',
              title: 'Flujo recomendado',
              children: (
                <ol className="list-decimal space-y-1.5 pl-4 text-xs text-muted-foreground">
                  <li>Revisa pagos sin reconciliar (lista arriba) y abre la orden.</li>
                  <li>Atiende reembolsos por aprobar antes que cortes.</li>
                  <li>Captura referencia y marca procesado los aprobados.</li>
                  <li>Valida cortes diarios y deposita por SPEI.</li>
                </ol>
              ),
            },
            {
              key: 'crons',
              title: 'Crons activos',
              children: (
                <ul className="space-y-1 text-[11px] text-muted-foreground">
                  <li><code>cron:pagos-reconciliar</code> · cada 5 min</li>
                  <li><code>cron:aprobaciones-expirar</code> · cada hora</li>
                  <li><code>cron:csat</code> · cada 30 min</li>
                </ul>
              ),
            },
          ]}
        />
      }
    />
  );
}

type KpiTone = 'warning' | 'info' | 'neutral';

const TONE_CLASS: Record<KpiTone, string> = {
  warning: 'border-warning/40 bg-warning/5 hover:bg-warning/10',
  info: 'border-info/40 bg-info/5 hover:bg-info/10',
  neutral: 'border-border bg-card hover:bg-muted/40',
};

function KpiCard({
  icon: Icon,
  count,
  label,
  hint,
  href,
  tone,
}: {
  icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'fill' | 'duotone'; 'aria-hidden'?: boolean }>;
  count: number;
  label: string;
  hint: string;
  href: string;
  tone: KpiTone;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col gap-1 rounded-lg border px-3 py-2.5 transition-colors ${TONE_CLASS[tone]}`}
    >
      <div className="flex items-center justify-between">
        <Icon size={14} aria-hidden weight="duotone" />
        <span className="text-2xl font-semibold tabular-nums">{count}</span>
      </div>
      <p className="text-xs font-medium leading-tight">{label}</p>
      <p className="text-[10px] text-muted-foreground leading-tight">{hint}</p>
    </Link>
  );
}
