import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, WarningOctagon } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { SoporteQueue } from '@/components/dashboard/soporte-queue';
import { ContextSidebar, WorkspaceShell } from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import {
  listarMimActivos,
  listarMimRecientes,
} from '@/lib/dashboard/queries/mim';
import {
  ESTADO_MIM_LABEL,
  esMimActivo,
  type EstadoMim,
} from '@/lib/dashboard/mim-shared';
import { formatFechaHora } from '@/lib/dashboard/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Major Incidents · Soporte · ExpressMX' };

const ESTADO_TONE: Record<EstadoMim, 'destructive' | 'warning' | 'success' | 'muted'> = {
  declarado: 'destructive',
  mitigando: 'warning',
  resuelto: 'success',
  pir_pendiente: 'warning',
  cerrado: 'muted',
};

export default async function MimQueuePage() {
  const viewer = await requirePermiso('soporte.abrir_caso');
  const puedeDeclarar = tienePermiso(viewer, 'soporte.mim.declarar');

  const [activos, recientes] = await Promise.all([
    listarMimActivos(),
    listarMimRecientes(20),
  ]);
  const cerrados = recientes.filter((m) => !esMimActivo(m.estado));

  return (
    <WorkspaceShell
      header={
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Workspace · Soporte
            </p>
            <h1 className="text-base font-semibold">Major Incidents</h1>
          </div>
          {puedeDeclarar ? (
            <Link
              href="/dashboard/soporte/mim/declarar"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
            >
              <Plus size={14} aria-hidden /> Declarar MIM
            </Link>
          ) : null}
        </div>
      }
      queue={<SoporteQueue viewer={viewer} active={{ kind: 'ninguno' }} bucket="mis" />}
      main={
        <div className="space-y-6">
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Activos ({activos.length})
            </h2>
            {activos.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                No hay Major Incidents activos. Cuando declares uno, aparecerá aquí
                y se mostrará un banner global a todo el equipo.
              </p>
            ) : (
              <ul className="space-y-2">
                {activos.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/dashboard/soporte/mim/${m.id}`}
                      className="block rounded-md border border-destructive/40 bg-destructive/5 p-3 hover:bg-destructive/10"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm font-medium">
                            <WarningOctagon
                              size={14}
                              weight="fill"
                              className="text-destructive"
                              aria-hidden
                            />
                            {m.titulo}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Declarado {formatFechaHora(m.declarado_at)} · {m.tickets_vinculados}{' '}
                            tickets vinculados
                            {m.servicios_afectados.length > 0
                              ? ` · ${m.servicios_afectados.join(', ')}`
                              : ''}
                          </p>
                        </div>
                        <Badge variant={ESTADO_TONE[m.estado]}>
                          {ESTADO_MIM_LABEL[m.estado]}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {cerrados.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Histórico reciente ({cerrados.length})
              </h2>
              <ul className="space-y-1.5">
                {cerrados.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/dashboard/soporte/mim/${m.id}`}
                      className="block rounded-md border border-border bg-card p-3 hover:bg-muted/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{m.titulo}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Declarado {formatFechaHora(m.declarado_at)}
                            {m.resuelto_at
                              ? ` · resuelto ${formatFechaHora(m.resuelto_at)}`
                              : ''}{' '}
                            · {m.tickets_vinculados} tickets
                          </p>
                        </div>
                        <Badge variant={ESTADO_TONE[m.estado]}>
                          {ESTADO_MIM_LABEL[m.estado]}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'tip',
              title: 'Cuándo declarar',
              children: (
                <p className="text-xs text-muted-foreground">
                  Declara un Major Incident cuando un fallo afecta a múltiples
                  clientes o servicios críticos al mismo tiempo. Vincula los tickets
                  derivados al MIM para coordinar comunicación.
                </p>
              ),
            },
          ]}
        />
      }
    />
  );
}
