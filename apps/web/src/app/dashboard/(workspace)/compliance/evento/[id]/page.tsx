import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowSquareOut, ShieldWarning } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { ComplianceQueue } from '@/components/dashboard/compliance-queue';
import { DiffViewer } from '@/components/dashboard/diff-viewer';
import {
  ContextSidebar,
  ItemForm,
  WorkspaceBreadcrumbs,
  WorkspaceShell,
} from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { formatFechaHora, formatFechaLarga } from '@/lib/dashboard/format';
import {
  getAccionesDelMismoCaso,
  getEventoDetalle,
} from '@/lib/dashboard/queries/compliance-workspace';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Evento · Compliance · ExpressMX' };

export default async function EventoCompliancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePermiso('auditoria.ver');
  const { id } = await params;
  const evento = await getEventoDetalle(id);
  if (!evento) notFound();

  const relacionadas = await getAccionesDelMismoCaso(
    evento.caso_id,
    evento.ticket_id,
    evento.id,
  );

  return (
    <WorkspaceShell
      accent="compliance"
      header={
        <div className="min-w-0">
          <WorkspaceBreadcrumbs
            items={[
              { label: 'Compliance', href: '/dashboard/compliance' },
              { label: 'Eventos', href: '/dashboard/compliance' },
              { label: evento.accion },
            ]}
          />
          <h1 className="mt-1 text-base font-semibold truncate">
            <code className="font-mono text-sm">{evento.accion}</code>
          </h1>
        </div>
      }
      queue={
        <ComplianceQueue
          viewerId={viewer.userId}
          active={{ kind: 'evento', id: evento.id }}
          bucket="eventos_hoy"
        />
      }
      main={
        <ItemForm
          title={evento.accion}
          subtitle={`Entidad ${evento.entidad}${evento.entidad_id ? ` · ${evento.entidad_id.slice(0, 8)}` : ''}`}
          badges={
            <>
              <Badge variant="info">{evento.entidad}</Badge>
              {evento.caso_id ? <Badge variant="info">Caso vinculado</Badge> : null}
              {evento.ticket_id ? <Badge variant="info">Ticket vinculado</Badge> : null}
            </>
          }
          meta={
            <span>
              {evento.admin_nombre || 'Sistema'} · {formatFechaLarga(evento.created_at)}
              {evento.ip_address ? ` · ${evento.ip_address}` : ''}
            </span>
          }
          fields={
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Diff antes / después
                </h3>
                <DiffViewer
                  before={evento.valor_anterior}
                  after={evento.valor_nuevo}
                />
              </div>

              {evento.user_agent ? (
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    User agent
                  </h3>
                  <p className="break-all rounded-md border border-border bg-card p-2 font-mono text-[11px] text-muted-foreground">
                    {evento.user_agent}
                  </p>
                </div>
              ) : null}
            </div>
          }
          activity={
            relacionadas.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Otras acciones en el mismo {evento.caso_id ? 'caso' : 'ticket'}:
                </p>
                <ul className="space-y-1">
                  {relacionadas.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border bg-card p-2 text-xs"
                    >
                      <Link
                        href={`/dashboard/compliance/evento/${r.id}`}
                        className="font-mono text-primary hover:underline"
                      >
                        {r.accion}
                      </Link>
                      <span className="text-muted-foreground">
                        {r.admin_nombre} · {formatFechaHora(r.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null
          }
        />
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'admin',
              title: 'Admin',
              children: (
                <div>
                  <p className="font-medium text-sm">{evento.admin_nombre || 'Sistema'}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {evento.admin_id.slice(0, 8)}
                  </p>
                </div>
              ),
            },
            ...(evento.caso_id
              ? [
                  {
                    key: 'caso',
                    title: 'Caso de soporte',
                    children: (
                      <Link
                        href={`/dashboard/soporte/caso/${evento.caso_id}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Ver caso completo <ArrowSquareOut size={10} aria-hidden />
                      </Link>
                    ),
                  },
                ]
              : []),
            ...(evento.ticket_id
              ? [
                  {
                    key: 'ticket',
                    title: 'Ticket',
                    children: (
                      <Link
                        href={`/dashboard/soporte/ticket/${evento.ticket_id}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Ver ticket <ArrowSquareOut size={10} aria-hidden />
                      </Link>
                    ),
                  },
                ]
              : []),
            ...(evento.entidad === 'reembolsos' && evento.entidad_id
              ? [
                  {
                    key: 'origen',
                    title: 'Reembolso',
                    children: (
                      <Link
                        href={`/dashboard/finanzas/reembolso/${evento.entidad_id}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Ver reembolso <ArrowSquareOut size={10} aria-hidden />
                      </Link>
                    ),
                  },
                ]
              : []),
            {
              key: 'sod',
              title: 'Notas de cumplimiento',
              children: (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <ShieldWarning size={12} aria-hidden className="mt-0.5 shrink-0" />
                  <span>
                    Si esta acción está vinculada a un caso o ticket, todo lo que el
                    agente hizo durante esa atención queda correlacionado en el activity
                    feed del item.
                  </span>
                </p>
              ),
            },
          ]}
        />
      }
    />
  );
}
