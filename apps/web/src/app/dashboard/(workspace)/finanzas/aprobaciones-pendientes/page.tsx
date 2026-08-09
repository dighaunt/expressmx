import type { Metadata } from 'next';
import Link from 'next/link';
import { Hourglass } from '@phosphor-icons/react/ssr';
import { AprobacionDecidirForm } from '@/components/dashboard/aprobacion-decidir-form';
import { ContextSidebar, WorkspaceShell } from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { listarPendientesPorGrupo } from '@/lib/dashboard/queries/aprobaciones';
import { formatFechaHora, formatMoneda } from '@/lib/dashboard/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Aprobaciones pendientes · Finanzas · ExpressMX',
};

const ENTIDAD_LABEL = {
  reembolsos: 'Reembolso',
  tareas_caso: 'Crédito / Tarea',
  saldo_cliente_movimientos: 'Crédito directo',
  suspensiones_cuenta: 'Suspensión',
} as const;

export default async function FinanzasAprobacionesPendientesPage() {
  const viewer = await requirePermiso('reembolsos.aprobar');
  const puedeDecidir = tienePermiso(viewer, 'reembolsos.aprobar');

  const aprobaciones = await listarPendientesPorGrupo('finanzas', 100);

  return (
    <WorkspaceShell
      queue={
        <nav className="flex flex-col gap-1 p-3 text-sm">
          <Link
            href="/dashboard/finanzas"
            className="rounded-md px-2 py-1.5 hover:bg-muted/40"
          >
            Reembolsos / Cortes / Facturas
          </Link>
          <Link
            href="/dashboard/finanzas/aprobaciones-pendientes"
            className="rounded-md bg-muted/60 px-2 py-1.5 font-medium"
          >
            Aprobaciones pendientes ({aprobaciones.length})
          </Link>
          <Link
            href="/dashboard/finanzas/tareas-bandeja"
            className="rounded-md px-2 py-1.5 hover:bg-muted/40"
          >
            Bandeja de tareas
          </Link>
        </nav>
      }
      header={
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Finanzas
            </p>
            <h1 className="text-base font-semibold">Aprobaciones pendientes</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            {aprobaciones.length} solicitud(es) esperando decisión
          </p>
        </div>
      }
      main={
        aprobaciones.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-background p-8 text-center">
            <Hourglass
              size={32}
              weight="duotone"
              aria-hidden
              className="mx-auto mb-2 text-muted-foreground"
            />
            <p className="text-sm font-medium">Sin solicitudes pendientes</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cuando soporte cree una solicitud que exceda los umbrales, aparecerá aquí.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {aprobaciones.map((a) => (
              <li
                key={a.id}
                className="rounded-md border border-border bg-background p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                        {ENTIDAD_LABEL[a.entidad]}
                      </span>
                      {a.monto_mxn ? (
                        <span className="tabular-nums text-sm font-semibold">
                          {formatMoneda(a.monto_mxn, true)}
                        </span>
                      ) : null}
                      <span className="text-[10px] text-muted-foreground">
                        Solicitada {formatFechaHora(a.created_at)} · expira{' '}
                        {formatFechaHora(a.expira_at)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-xs text-foreground">
                      {a.motivo_md}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Por {a.solicitado_por_nombre}
                    </p>
                  </div>
                  {puedeDecidir ? (
                    <AprobacionDecidirForm aprobacionId={a.id} />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">
                      Sin permiso para decidir
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'leyenda',
              title: 'Cómo funciona',
              children: (
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>
                    Soporte solicita reembolsos {'>'} ${500} MXN o créditos {'>'} ${300}{' '}
                    MXN sin permiso express. Aquí los aprueba quien tiene{' '}
                    <code className="rounded bg-muted px-1 py-0.5">reembolsos.aprobar</code>.
                  </p>
                  <p>
                    Aprobar una solicitud no procesa el reembolso automáticamente: solo
                    autoriza la tarea correspondiente en{' '}
                    <Link href="/dashboard/finanzas/tareas-bandeja" className="text-primary underline">
                      bandeja de tareas
                    </Link>
                    .
                  </p>
                  <p>
                    Segregación de funciones: quien aprueba no puede ser quien solicitó.
                  </p>
                </div>
              ),
            },
          ]}
        />
      }
    />
  );
}
