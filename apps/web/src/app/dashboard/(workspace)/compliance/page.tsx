import type { Metadata } from 'next';
import { ShieldCheck } from '@phosphor-icons/react/ssr';
import { ComplianceQueue } from '@/components/dashboard/compliance-queue';
import { EmptyState } from '@/components/dashboard/empty-state';
import { ContextSidebar, WorkspaceShell, WorkspaceTools } from '@/components/workspace';
import { ForbiddenError } from '@/lib/errors/http-errors';
import { requireViewer } from '@/lib/dashboard/auth-gate';
import { tieneAlgunPermiso, tienePermiso } from '@/lib/dashboard/rbac';
import { formatFechaHora, formatNumero } from '@/lib/dashboard/format';
import {
  topAdminsHoy,
  topEntidades7d,
  type ComplianceBucket,
} from '@/lib/dashboard/queries/compliance-workspace';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Compliance · ExpressMX' };

interface SearchParams {
  bucket?: string;
}

export default async function ComplianceHomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requireViewer();
  if (!tieneAlgunPermiso(viewer, ['auditoria.ver', 'roles.gestionar', 'sistema.ver', 'reportes.ver'])) {
    throw new ForbiddenError('No tienes permisos de gobierno o compliance');
  }
  const sp = await searchParams;
  const bucket = (sp.bucket ?? 'eventos_7d') as ComplianceBucket;
  const puedeAuditar = tienePermiso(viewer, 'auditoria.ver');

  const [admins, entidades] = puedeAuditar
    ? await Promise.all([topAdminsHoy(5), topEntidades7d(8)])
    : [[], []];

  return (
    <WorkspaceShell
      header={
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Workspace
            </p>
            <h1 className="text-base font-semibold">Compliance / GRC</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Audita acciones, detecta violaciones SoD y correlaciona por caso o ticket.
          </p>
        </div>
      }
      queue={
        puedeAuditar ? (
          <ComplianceQueue
            viewerId={viewer.userId}
            active={{ kind: 'ninguno' }}
            bucket={bucket}
          />
        ) : (
          <div className="p-3">
            <WorkspaceTools viewer={viewer} groups={['gobierno']} compact />
          </div>
        )
      }
      main={
        <EmptyState
          icon={ShieldCheck}
          title={puedeAuditar ? 'Selecciona un evento' : 'Selecciona una herramienta'}
          description={
            puedeAuditar
              ? 'Verás el diff antes/después, el contexto del caso o ticket relacionado, y otras acciones del mismo agente cuando abras un item.'
              : 'Las herramientas de gobierno se abren dentro de este workspace según tus permisos RBAC.'
          }
        />
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'herramientas',
              title: 'Gobierno y sistema',
              children: <WorkspaceTools viewer={viewer} groups={['gobierno']} compact />,
            },
            {
              key: 'top_admins',
              title: 'Top admins (hoy)',
              children:
                admins.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin actividad hoy.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {admins.map((a) => (
                      <li
                        key={a.admin_id}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="truncate font-medium">
                          {a.admin_nombre || 'Sistema'}
                        </span>
                        <span className="font-semibold tabular-nums text-foreground">
                          {formatNumero(a.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ),
            },
            {
              key: 'top_entidades',
              title: 'Top entidades (7d)',
              children:
                entidades.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin eventos.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {entidades.map((e) => (
                      <li
                        key={e.entidad}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="truncate font-mono text-[11px]">{e.entidad}</span>
                        <span className="font-semibold tabular-nums text-foreground">
                          {formatNumero(e.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ),
            },
            {
              key: 'sod',
              title: 'Política SoD',
              children: (
                <p className="text-xs text-muted-foreground">
                  Las alertas SoD se generan cuando el mismo admin que aprobó un reembolso
                  también lo marcó como procesado. La server action lo bloquea, así que
                  cualquier alerta histórica indica registros previos a la implementación
                  o ejecución directa contra BD.
                </p>
              ),
            },
            {
              key: 'now',
              title: 'Hora del servidor',
              children: (
                <p className="font-mono text-[11px] text-muted-foreground">
                  {formatFechaHora(new Date())}
                </p>
              ),
            },
          ]}
        />
      }
    />
  );
}
