import type { Metadata } from 'next';
import { ChartLine } from '@phosphor-icons/react/ssr';
import { ContextSidebar, WorkspaceShell } from '@/components/workspace';
import { SoporteQueue } from '@/components/dashboard/soporte-queue';
import { MetricCard } from '@/components/dashboard/metric-card';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { getRendimientoAgente } from '@/lib/dashboard/queries/soporte-workspace';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Mi rendimiento · Soporte · ExpressMX',
};

function formatHoras(h: number | null): string {
  if (h === null) return '—';
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${h.toFixed(1)} h`;
}

function formatMin(m: number | null): string {
  if (m === null) return '—';
  if (m >= 60) return `${(m / 60).toFixed(1)} h`;
  return `${Math.round(m)} min`;
}

function formatPct(p: number | null): string {
  if (p === null) return '—';
  return `${p.toFixed(0)}%`;
}

function formatScore(s: number | null): string {
  if (s === null) return '—';
  return `${s.toFixed(2)} / 5`;
}

export default async function MiRendimientoPage() {
  const viewer = await requirePermiso('soporte.abrir_caso');
  const r = await getRendimientoAgente(viewer.userId, 30);

  return (
    <WorkspaceShell
      header={
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Workspace · Soporte
          </p>
          <h1 className="flex items-center gap-2 text-base font-semibold">
            <ChartLine size={16} weight="duotone" aria-hidden />
            Mi rendimiento (últimos {r.ventana_dias} días)
          </h1>
        </div>
      }
      queue={<SoporteQueue viewer={viewer} active={{ kind: 'ninguno' }} bucket="mis" />}
      main={
        <div className="space-y-6">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Tickets resueltos"
              value={r.tickets_resueltos.toString()}
              hint={
                r.tickets_escalados > 0
                  ? `${r.tickets_escalados} escalados`
                  : 'Sin escalaciones'
              }
            />
            <MetricCard
              label="TTR promedio"
              value={formatHoras(r.ttr_promedio_horas)}
              hint="Tiempo total a resolución"
            />
            <MetricCard
              label="FRT promedio"
              value={formatMin(r.frt_promedio_minutos)}
              hint="Primera respuesta al cliente"
            />
            <MetricCard
              label="FCR"
              value={formatPct(r.fcr_porcentaje)}
              hint="Resueltos en primer contacto"
            />
            <MetricCard
              label="CSAT"
              value={formatScore(r.csat_promedio)}
              hint={`${r.csat_respuestas} encuestas respondidas`}
            />
            <MetricCard
              label="SLA breach"
              value={formatPct(r.sla_breach_porcentaje)}
              hint="Tickets cerrados con SLA roto"
            />
          </section>

          <section className="rounded-md border border-border bg-card p-4 text-xs text-muted-foreground">
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              Cómo se calculan
            </h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>TTR</strong>: tiempo entre creación y cierre de tickets que tú
                cerraste.
              </li>
              <li>
                <strong>FRT</strong>: tiempo entre creación y primera respuesta al
                cliente.
              </li>
              <li>
                <strong>FCR</strong>: porcentaje de cierres con código{' '}
                <code>resuelto_directo</code> (no requirió escalación o segundo
                contacto).
              </li>
              <li>
                <strong>CSAT</strong>: promedio de las encuestas que te tocaron y que
                el cliente respondió en la ventana.
              </li>
              <li>
                <strong>SLA breach</strong>: porcentaje de tus tickets cerrados con{' '}
                <code>breached_ttr = TRUE</code>.
              </li>
            </ul>
          </section>
        </div>
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'meta',
              title: 'Metas de equipo',
              children: (
                <ul className="space-y-1.5 text-xs">
                  <li>
                    <span className="text-muted-foreground">FRT</span> ≤ 15 min en alta y
                    crítica
                  </li>
                  <li>
                    <span className="text-muted-foreground">CSAT</span> ≥ 4.3 / 5
                  </li>
                  <li>
                    <span className="text-muted-foreground">FCR</span> ≥ 60%
                  </li>
                  <li>
                    <span className="text-muted-foreground">SLA breach</span> ≤ 5%
                  </li>
                </ul>
              ),
            },
          ]}
        />
      }
    />
  );
}
