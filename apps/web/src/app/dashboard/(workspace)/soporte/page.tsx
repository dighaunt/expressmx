import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ChartLine,
  Lifebuoy,
  WarningOctagon,
} from '@phosphor-icons/react/ssr';
import { MetricCard } from '@/components/dashboard/metric-card';
import { SoporteQueue } from '@/components/dashboard/soporte-queue';
import { ContextSidebar, WorkspaceShell, WorkspaceTools } from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { getSoporteHomeKpis, type SoporteBucket } from '@/lib/dashboard/queries/soporte-workspace';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Soporte · ExpressMX' };

interface SearchParams {
  bucket?: string;
  tipo?: string;
}

const TIPOS_VALIDOS = new Set(['incidente', 'solicitud', 'problema', 'cambio']);
const BUCKETS_VALIDOS = new Set([
  'equipo',
  'mis',
  'sin_asignar',
  'acciones',
  'resueltos',
  'casos',
]);

function formatScore(s: number | null): string {
  if (s === null) return '—';
  return `${s.toFixed(2)} / 5`;
}

export default async function SoporteHomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requirePermiso('soporte.abrir_caso');
  const sp = await searchParams;
  const bucket = BUCKETS_VALIDOS.has(sp.bucket ?? '')
    ? (sp.bucket as SoporteBucket | 'casos')
    : 'equipo';
  const tipo =
    sp.tipo && TIPOS_VALIDOS.has(sp.tipo)
      ? (sp.tipo as 'incidente' | 'solicitud' | 'problema' | 'cambio')
      : undefined;

  const kpis = await getSoporteHomeKpis();
  const puedeDeclararMim = tienePermiso(viewer, 'soporte.mim.declarar');

  return (
    <WorkspaceShell
      header={
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Workspace
            </p>
            <h1 className="text-base font-semibold">Soporte</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/soporte/mi-rendimiento"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
            >
              <ChartLine size={12} aria-hidden /> Mi rendimiento
            </Link>
            <Link
              href="/dashboard/soporte/mim"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
            >
              <WarningOctagon size={12} aria-hidden /> MIM
            </Link>
          </div>
        </div>
      }
      queue={
        <SoporteQueue
          viewer={viewer}
          active={{ kind: 'ninguno' }}
          bucket={bucket}
          {...(tipo ? { tipo } : {})}
        />
      }
      main={
        <div className="space-y-6">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Major incidents"
              value={kpis.mim_activos.toString()}
              hint={
                kpis.mim_activos === 0
                  ? 'Sin incidentes activos'
                  : 'Activos ahora mismo'
              }
              accent={kpis.mim_activos > 0 ? 'destructive' : 'neutral'}
              icon={WarningOctagon}
            />
            <MetricCard
              label="SLA roto"
              value={kpis.tickets_breached.toString()}
              hint="Tickets abiertos con TTR vencido"
              accent={kpis.tickets_breached > 0 ? 'warning' : 'neutral'}
            />
            <MetricCard
              label="CSAT 30d"
              value={formatScore(kpis.csat_promedio_30d)}
              hint="Equipo, últimos 30 días"
              accent="neutral"
            />
            <MetricCard
              label="Resueltos hoy"
              value={kpis.resueltos_hoy_equipo.toString()}
              hint="Todo el equipo, hoy"
              accent={kpis.resueltos_hoy_equipo > 0 ? 'success' : 'neutral'}
            />
          </section>

          <section className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <Lifebuoy size={18} weight="duotone" aria-hidden />
              <div>
                <p className="font-medium text-foreground">
                  Selecciona un caso o ticket
                </p>
                <p className="mt-1 text-xs">
                  Las acciones disponibles y el contexto del cliente aparecen aquí
                  cuando abres un item de la cola.
                </p>
                {puedeDeclararMim ? (
                  <p className="mt-2 text-xs">
                    ¿Detectaste un fallo masivo?{' '}
                    <Link
                      href="/dashboard/soporte/mim/declarar"
                      className="font-medium text-destructive hover:underline"
                    >
                      Declara un Major Incident
                    </Link>
                    .
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'herramientas',
              title: 'Herramientas de soporte',
              children: <WorkspaceTools viewer={viewer} groups={['soporte']} compact />,
            },
            {
              key: 'tip',
              title: 'Tip',
              children: (
                <p className="text-xs text-muted-foreground">
                  Los tickets nacen desde la app del cliente o integraciones. Soporte
                  atiende la cola, documenta el avance y cierra con resolución.
                </p>
              ),
            },
            {
              key: 'rendimiento',
              title: 'Rendimiento',
              children: (
                <Link
                  href="/dashboard/soporte/mi-rendimiento"
                  className="block rounded-md border border-border bg-background p-2.5 text-xs hover:bg-muted/40"
                >
                  Ver TTR / FRT / FCR / CSAT de los últimos 30 días.
                </Link>
              ),
            },
          ]}
        />
      }
    />
  );
}
