import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowSquareOut,
  Clock,
  LinkSimple,
  WarningOctagon,
} from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import {
  ContextSidebar,
  WorkspaceBreadcrumbs,
  WorkspaceShell,
} from '@/components/workspace';
import { SoporteQueue } from '@/components/dashboard/soporte-queue';
import { MimUpdateForm } from '@/components/dashboard/mim-update-form';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import {
  getMimDetalle,
  listarTicketsVinculadosMim,
  listarUpdatesMim,
} from '@/lib/dashboard/queries/mim';
import {
  ESTADO_MIM_LABEL,
  esMimActivo,
  type EstadoMim,
} from '@/lib/dashboard/mim-shared';
import { formatFechaHora } from '@/lib/dashboard/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'War room · Major Incident · ExpressMX',
};

const ESTADO_TONE: Record<EstadoMim, 'destructive' | 'warning' | 'success' | 'muted'> = {
  declarado: 'destructive',
  mitigando: 'warning',
  resuelto: 'success',
  pir_pendiente: 'warning',
  cerrado: 'muted',
};

export default async function MimWarRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requirePermiso('soporte.abrir_caso');

  const detalle = await getMimDetalle(id);
  if (!detalle) notFound();

  const [updates, tickets] = await Promise.all([
    listarUpdatesMim(id),
    listarTicketsVinculadosMim(id),
  ]);

  const puedeUpdate = tienePermiso(viewer, 'soporte.mim.publicar_update');
  const puedeCerrar = tienePermiso(viewer, 'soporte.mim.cerrar');
  const activo = esMimActivo(detalle.estado);

  return (
    <WorkspaceShell
      accent="soporte"
      header={
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <WorkspaceBreadcrumbs
              items={[
                { label: 'Soporte', href: '/dashboard/soporte' },
                { label: 'MIM', href: '/dashboard/soporte' },
                { label: detalle.titulo },
              ]}
            />
            <h1 className="mt-1 flex items-center gap-2 text-base font-semibold">
              <WarningOctagon
                size={16}
                weight="fill"
                className="text-destructive"
                aria-hidden
              />
              <span className="truncate">{detalle.titulo}</span>
            </h1>
          </div>
          <Badge variant={ESTADO_TONE[detalle.estado]}>
            {ESTADO_MIM_LABEL[detalle.estado]}
          </Badge>
        </div>
      }
      queue={<SoporteQueue viewer={viewer} active={{ kind: 'ninguno' }} bucket="mis" />}
      main={
        <div className="space-y-6">
          <section className="space-y-2 rounded-md border border-border bg-card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Descripción
            </h2>
            <p className="whitespace-pre-wrap text-sm">{detalle.descripcion}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Declarado por</dt>
                <dd className="font-medium">{detalle.declarado_por_nombre}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Declarado</dt>
                <dd className="font-medium">{formatFechaHora(detalle.declarado_at)}</dd>
              </div>
              {detalle.mitigado_at ? (
                <div>
                  <dt className="text-muted-foreground">Mitigado</dt>
                  <dd className="font-medium">{formatFechaHora(detalle.mitigado_at)}</dd>
                </div>
              ) : null}
              {detalle.resuelto_at ? (
                <div>
                  <dt className="text-muted-foreground">Resuelto</dt>
                  <dd className="font-medium">{formatFechaHora(detalle.resuelto_at)}</dd>
                </div>
              ) : null}
              {detalle.servicios_afectados.length > 0 ? (
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Servicios afectados</dt>
                  <dd className="font-medium">
                    {detalle.servicios_afectados.join(', ')}
                  </dd>
                </div>
              ) : null}
              {detalle.pir_url ? (
                <div className="col-span-2">
                  <dt className="text-muted-foreground">PIR</dt>
                  <dd>
                    <a
                      href={detalle.pir_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <LinkSimple size={12} aria-hidden /> Ver PIR
                      <ArrowSquareOut size={11} aria-hidden />
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          {puedeUpdate && activo ? (
            <MimUpdateForm
              mimId={detalle.id}
              estadoActual={detalle.estado}
              pirUrlActual={detalle.pir_url}
              puedeCerrar={puedeCerrar}
            />
          ) : null}

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Updates ({updates.length})
            </h2>
            {updates.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                Aún no se publican updates.
              </p>
            ) : (
              <ol className="space-y-2">
                {updates.map((u) => (
                  <li
                    key={u.id}
                    className="rounded-md border border-border bg-card p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock size={12} aria-hidden />
                        {formatFechaHora(u.publicado_at)} · {u.publicado_por_nombre}
                      </span>
                      <Badge variant={ESTADO_TONE[u.estado_en_momento]}>
                        {ESTADO_MIM_LABEL[u.estado_en_momento]}
                      </Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{u.contenido_md}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tickets vinculados ({tickets.length})
            </h2>
            {tickets.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                Sin tickets vinculados todavía.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {tickets.map((t) => (
                  <li key={t.ticket_id}>
                    <Link
                      href={`/dashboard/soporte/ticket/${t.ticket_id}`}
                      className="block rounded-md border border-border bg-card p-2.5 hover:bg-muted/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{t.asunto}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Vinculado {formatFechaHora(t.vinculado_at)} ·{' '}
                            {t.vinculado_por_nombre}
                          </p>
                        </div>
                        <Badge variant="outline">{t.estatus}</Badge>
                      </div>
                    </Link>
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
              key: 'estado',
              title: 'Estado',
              children: (
                <div className="space-y-1.5 text-xs">
                  <p>
                    <span className="text-muted-foreground">Actual:</span>{' '}
                    <Badge variant={ESTADO_TONE[detalle.estado]}>
                      {ESTADO_MIM_LABEL[detalle.estado]}
                    </Badge>
                  </p>
                  <p className="text-muted-foreground">
                    {activo
                      ? 'Mientras esté activo, aparecerá un banner en todo el panel.'
                      : 'Este MIM está cerrado. No se aceptan más updates ni vinculaciones.'}
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
