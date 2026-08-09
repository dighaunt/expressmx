import type { Metadata } from 'next';
import {
  ChartLine,
  ClipboardText,
  CurrencyCircleDollar,
  MapTrifold,
  Tag,
  UsersThree,
} from '@phosphor-icons/react/ssr';
import { MetricCard } from '@/components/dashboard/metric-card';
import { PageHeader } from '@/components/dashboard/page-header';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { formatMoneda, formatNumero } from '@/lib/dashboard/format';
import {
  getMetricasResumen,
  getOrdenesPorEstatus,
  getSerieUltimos6Meses,
  getTopCategorias,
  getTopPrestadores,
  getTopZonas,
} from '@/lib/dashboard/queries/reportes';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Reportes · ExpressMX' };

const ESTATUS_LABEL: Record<string, string> = {
  solicitada: 'Solicitada',
  asignada: 'Asignada',
  en_camino: 'En camino',
  en_progreso: 'En progreso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

const MES_LABEL = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' });

function deltaPct(actual: number, anterior: number): number {
  if (anterior === 0) return actual > 0 ? 100 : 0;
  return ((actual - anterior) / anterior) * 100;
}

function deltaToneClass(delta: number): string {
  if (delta > 0) return 'text-success';
  if (delta < 0) return 'text-destructive';
  return 'text-muted-foreground';
}

function deltaPrefix(delta: number): string {
  if (delta > 0) return '+';
  if (delta < 0) return '';
  return '±';
}

export default async function ReportesPage() {
  await requirePermiso('reportes.ver');

  const [resumen, porEstatus, topCategorias, topPrestadores, topZonas, serie] =
    await Promise.all([
      getMetricasResumen(),
      getOrdenesPorEstatus(),
      getTopCategorias(),
      getTopPrestadores(),
      getTopZonas(),
      getSerieUltimos6Meses(),
    ]);

  const ingresoActual = Number(resumen.ingresos_mes);
  const ingresoAnterior = Number(resumen.ingresos_mes_anterior);
  const deltaIngresos = deltaPct(ingresoActual, ingresoAnterior);
  const deltaOrdenes = deltaPct(resumen.ordenes_mes, resumen.ordenes_mes_anterior);

  const totalOrdenesMes = porEstatus.reduce((acc, x) => acc + x.total, 0);
  const completadas = porEstatus.find((x) => x.estatus === 'completada')?.total ?? 0;
  const canceladas = porEstatus.find((x) => x.estatus === 'cancelada')?.total ?? 0;
  const tasaCancelacion = totalOrdenesMes > 0 ? (canceladas / totalOrdenesMes) * 100 : 0;
  const tasaCompletado = totalOrdenesMes > 0 ? (completadas / totalOrdenesMes) * 100 : 0;

  const maxIngresoMes = serie.reduce(
    (acc, m) => Math.max(acc, Number(m.ingresos)),
    0,
  );

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Métricas operativas y financieras del mes en curso"
      />

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={ClipboardText}
          label="Órdenes completadas"
          value={formatNumero(resumen.ordenes_mes)}
          accent="primary"
          hint={`${deltaPrefix(deltaOrdenes)}${deltaOrdenes.toFixed(1)}% vs mes anterior`}
        />
        <MetricCard
          icon={CurrencyCircleDollar}
          label="Ingresos del mes"
          value={formatMoneda(resumen.ingresos_mes, true)}
          accent="success"
          hint={`${deltaPrefix(deltaIngresos)}${deltaIngresos.toFixed(1)}% vs mes anterior`}
        />
        <MetricCard
          icon={ChartLine}
          label="Ticket promedio"
          value={formatMoneda(resumen.ticket_promedio_mes, true)}
          accent="primary"
        />
        <MetricCard
          icon={CurrencyCircleDollar}
          label="Comisión plataforma"
          value={formatMoneda(resumen.comision_plataforma_mes, true)}
          accent="primary"
        />
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={UsersThree}
          label="Prestadores activos"
          value={formatNumero(resumen.prestadores_activos_mes)}
          accent="neutral"
        />
        <MetricCard
          icon={UsersThree}
          label="Clientes activos"
          value={formatNumero(resumen.clientes_activos_mes)}
          accent="neutral"
        />
        <MetricCard
          icon={ClipboardText}
          label="Tasa de completado"
          value={`${tasaCompletado.toFixed(1)}%`}
          accent="success"
        />
        <MetricCard
          icon={ClipboardText}
          label="Tasa de cancelación"
          value={`${tasaCancelacion.toFixed(1)}%`}
          accent={tasaCancelacion > 10 ? 'destructive' : 'neutral'}
        />
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Tendencia últimos 6 meses
        </h2>
        <div className="rounded-xl border border-border bg-card p-4">
          {serie.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos suficientes todavía.</p>
          ) : (
            <div className="space-y-3">
              {serie.map((m) => {
                const ingresos = Number(m.ingresos);
                const ratio = maxIngresoMes > 0 ? ingresos / maxIngresoMes : 0;
                const label = MES_LABEL.format(new Date(`${m.mes}-01T00:00:00`));
                return (
                  <div key={m.mes}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="capitalize text-muted-foreground">{label}</span>
                      <span className="font-semibold tabular-nums">
                        {formatMoneda(m.ingresos, true)}{' '}
                        <span className="text-muted-foreground">
                          · {formatNumero(m.ordenes)} órdenes
                        </span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.max(2, ratio * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel
          icon={ClipboardText}
          title="Órdenes por estatus (mes en curso)"
          rows={porEstatus.map((e) => ({
            label: ESTATUS_LABEL[e.estatus] ?? e.estatus,
            primary: formatNumero(e.total),
            secondary: formatMoneda(e.monto, true),
          }))}
        />
        <Panel
          icon={Tag}
          title="Top categorías"
          rows={topCategorias.map((c) => ({
            label: c.nombre,
            primary: formatMoneda(c.ingresos, true),
            secondary: `${formatNumero(c.total)} órdenes`,
          }))}
        />
        <Panel
          icon={UsersThree}
          title="Top prestadores"
          rows={topPrestadores.map((p) => ({
            label: p.nombre,
            primary: formatMoneda(p.ingresos, true),
            secondary: `${formatNumero(p.total)} órdenes`,
          }))}
        />
        <Panel
          icon={MapTrifold}
          title="Top zonas"
          rows={topZonas.map((z) => ({
            label: z.nombre,
            primary: formatMoneda(z.ingresos, true),
            secondary: `${formatNumero(z.total)} órdenes`,
          }))}
        />
      </section>
    </>
  );
}

function Panel({
  icon: IconCmp,
  title,
  rows,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  rows: Array<{ label: string; primary: string; secondary: string }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <IconCmp size={14} aria-hidden />
        </span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">Sin datos.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
              <span className="truncate">{r.label}</span>
              <span className="text-right">
                <span className="font-semibold tabular-nums">{r.primary}</span>
                <span className="ml-2 text-xs text-muted-foreground">{r.secondary}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
