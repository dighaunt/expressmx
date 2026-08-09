import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Robot, User, UserGear } from '@phosphor-icons/react/ssr';
import { PageHeader } from '@/components/dashboard/page-header';
import { PrioridadBadge } from '@/components/dashboard/prioridad-badge';
import { TicketControls } from '@/components/dashboard/ticket-controls';
import { TicketEstatusBadge } from '@/components/dashboard/ticket-estatus-badge';
import { TicketReply } from '@/components/dashboard/ticket-reply';
import { TicketRealtimeRefresh } from '@/components/dashboard/ticket-realtime-refresh';
import { WorkspaceBreadcrumbs } from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { formatFechaHora } from '@/lib/dashboard/format';
import {
  CATEGORIA_LABEL,
  getTicket,
  listarMensajesTicket,
  type TipoAutorMsg,
} from '@/lib/dashboard/queries/tickets';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Ticket · ExpressMX' };

const ICON_BY_AUTOR: Record<TipoAutorMsg, React.ReactNode> = {
  usuario: <User size={14} aria-hidden />,
  agente: <UserGear size={14} aria-hidden />,
  sistema: <Robot size={14} aria-hidden />,
};

const LABEL_AUTOR: Record<TipoAutorMsg, string> = {
  usuario: 'Cliente',
  agente: 'Soporte',
  sistema: 'Sistema',
};

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePermiso('tickets.ver');
  const { id } = await params;
  const [ticket, mensajes] = await Promise.all([
    getTicket(id),
    listarMensajesTicket(id),
  ]);
  if (!ticket) notFound();

  const canManage = tienePermiso(viewer, 'tickets.gestionar');

  return (
    <>
      <TicketRealtimeRefresh ticketId={ticket.id} />
      <WorkspaceBreadcrumbs
        className="mb-3"
        items={[
          { label: 'Tickets', href: '/dashboard/tickets' },
          { label: `#${ticket.id.slice(0, 8).toUpperCase()}` },
        ]}
      />

      <PageHeader
        title={ticket.asunto}
        description={`#${ticket.id.slice(0, 8).toUpperCase()} · ${CATEGORIA_LABEL[ticket.categoria]}`}
        actions={
          <div className="flex items-center gap-2">
            <PrioridadBadge prioridad={ticket.prioridad} />
            <TicketEstatusBadge estatus={ticket.estatus} />
          </div>
        }
      />

      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-2">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Reportado por
          </h2>
          <div>
            <p className="font-medium">{ticket.usuario_nombre}</p>
            <p className="text-xs text-muted-foreground capitalize">{ticket.rol_usuario}</p>
            {ticket.orden_id ? (
              <Link
                href={`/dashboard/ordenes/${ticket.orden_id}`}
                className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
              >
                Ver orden relacionada
              </Link>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Abierto el {formatFechaHora(ticket.created_at)} · Última actualización{' '}
            {formatFechaHora(ticket.updated_at)}
          </p>
        </div>

        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Mensajes
          </h2>
          <p className="text-3xl font-semibold tabular-nums tracking-tight">
            {ticket.mensajes_count}
          </p>
        </div>
      </section>

      {canManage ? (
        <section className="mb-6">
          <TicketControls
            ticketId={ticket.id}
            estatus={ticket.estatus}
            prioridad={ticket.prioridad}
            agenteId={ticket.agente_id}
            agenteNombre={ticket.agente_nombre}
            viewerId={viewer.userId}
          />
        </section>
      ) : null}

      <section className="mb-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Conversación
        </h2>
        {mensajes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            Sin mensajes todavía. Escribe el primer mensaje al cliente.
          </div>
        ) : (
          <ul className="space-y-3">
            {mensajes.map((m) => {
              const ownAgente = m.tipo_autor === 'agente';
              return (
                <li
                  key={m.id}
                  className={cn(
                    'flex',
                    ownAgente ? 'justify-end' : m.tipo_autor === 'sistema' ? 'justify-center' : 'justify-start',
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm',
                      ownAgente
                        ? 'bg-primary text-primary-foreground'
                        : m.tipo_autor === 'sistema'
                          ? 'bg-muted text-muted-foreground italic'
                          : 'bg-card border border-border',
                    )}
                  >
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium opacity-80">
                      {ICON_BY_AUTOR[m.tipo_autor]}
                      <span>
                        {LABEL_AUTOR[m.tipo_autor]}
                        {m.autor_nombre ? ` · ${m.autor_nombre}` : ''}
                      </span>
                      <span>·</span>
                      <span>{formatFechaHora(m.created_at)}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{m.contenido}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {canManage ? <TicketReply ticketId={ticket.id} estatus={ticket.estatus} /> : null}
    </>
  );
}
