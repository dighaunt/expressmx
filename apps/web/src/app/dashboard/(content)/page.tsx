import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CaretRight,
  ChartLine,
  ClipboardText,
  CurrencyCircleDollar,
  Lifebuoy,
  UsersThree,
} from '@phosphor-icons/react/ssr';
import { MetricCard } from '@/components/dashboard/metric-card';
import { PageHeader } from '@/components/dashboard/page-header';
import { appsParaViewerPorGrupo } from '@/lib/dashboard/apps';
import { getMetricasGlobales } from '@/lib/dashboard/queries/metricas';
import { etiquetaDeRol, tienePermiso } from '@/lib/dashboard/rbac';
import { formatMoneda, formatNumero } from '@/lib/dashboard/format';
import { requireViewer } from '@/lib/dashboard/auth-gate';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Inicio · ExpressMX' };

export default async function DashboardHome() {
  const viewer = await requireViewer();
  const apps = appsParaViewerPorGrupo(viewer).workspace.filter((a) => a.id !== 'inicio');

  const verMetricas =
    tienePermiso(viewer, 'reportes.ver') ||
    tienePermiso(viewer, 'ordenes.ver') ||
    tienePermiso(viewer, 'finanzas.ver');

  const metricas = verMetricas ? await getMetricasGlobales() : null;

  return (
    <>
      <PageHeader
        title={`Hola${viewer.nombre ? `, ${viewer.nombre}` : ''}`}
        description={`Acceso como ${etiquetaDeRol(viewer.rolPrincipal)}.`}
      />

      {metricas ? (
        <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Órdenes hoy"
            value={formatNumero(metricas.ordenes_hoy)}
            hint={`${formatNumero(metricas.ordenes_activas)} activas`}
            icon={ClipboardText}
            accent="primary"
          />
          <MetricCard
            label="Prestadores en turno"
            value={formatNumero(metricas.prestadores_activos)}
            icon={UsersThree}
            accent="success"
          />
          <MetricCard
            label="Ingreso hoy"
            value={formatMoneda(metricas.ingreso_hoy)}
            hint={`${formatMoneda(metricas.ingreso_mes)} este mes`}
            icon={CurrencyCircleDollar}
            accent="success"
          />
          <MetricCard
            label="Tickets abiertos"
            value={formatNumero(metricas.tickets_abiertos)}
            icon={Lifebuoy}
            accent={metricas.tickets_abiertos > 5 ? 'warning' : 'neutral'}
          />
        </section>
      ) : null}

      <section className="mb-2">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Tus aplicaciones
        </h2>
        {apps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
            Tu rol todavía no tiene aplicaciones asignadas. Contacta a tu administrador.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => {
              const Icon = app.icon;
              return (
                <li key={app.id}>
                  <Link
                    href={app.href}
                    className={cn(
                      'group flex h-full items-start gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-all',
                      'hover:ring-primary/30 hover:shadow-sm',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex size-10 shrink-0 items-center justify-center rounded-lg',
                        app.iconClassName,
                      )}
                    >
                      <Icon size={20} weight="duotone" aria-hidden />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{app.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{app.description}</p>
                    </div>
                    <CaretRight
                      size={16}
                      className="text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <ChartLine size={14} aria-hidden />
        <span>
          Las métricas se actualizan en cada visita. Para reportes detallados ve a la
          aplicación correspondiente.
        </span>
      </section>
    </>
  );
}
