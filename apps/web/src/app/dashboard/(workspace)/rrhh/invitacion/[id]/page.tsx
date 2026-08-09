import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { InvitacionActions } from '@/components/dashboard/invitacion-actions';
import { RRHHQueue } from '@/components/dashboard/rrhh-queue';
import {
  ContextSidebar,
  ItemForm,
  WorkspaceBreadcrumbs,
  WorkspaceShell,
} from '@/components/workspace';
import { ForbiddenError } from '@/lib/errors/http-errors';
import { requireViewer } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { formatFechaHora, formatFechaLarga } from '@/lib/dashboard/format';
import { getInvitacionDetalle } from '@/lib/dashboard/queries/rrhh-workspace';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Invitación · RRHH · ExpressMX' };

const ESTADO_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'muted'> = {
  disponible: 'success',
  expirada: 'warning',
  revocada: 'destructive',
  usada: 'muted',
};

const ESTADO_LABEL: Record<string, string> = {
  disponible: 'Disponible',
  expirada: 'Expirada',
  revocada: 'Revocada',
  usada: 'Usada',
};

export default async function InvitacionWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireViewer();
  if (!tienePermiso(viewer, 'prestadores.invitar')) {
    throw new ForbiddenError('Necesitas permiso prestadores.invitar');
  }
  const { id } = await params;
  const inv = await getInvitacionDetalle(id);
  if (!inv) notFound();

  const expiraEnMs = new Date(inv.expira_en).getTime() - Date.now();
  const expiraDias = Math.max(0, Math.floor(expiraEnMs / (1000 * 60 * 60 * 24)));

  return (
    <WorkspaceShell
      accent="rrhh"
      header={
        <div className="min-w-0">
          <WorkspaceBreadcrumbs
            items={[
              { label: 'RRHH', href: '/dashboard/rrhh' },
              {
                label: 'Invitaciones',
                href: '/dashboard/rrhh?bucket=invitaciones',
              },
              { label: inv.codigo },
            ]}
          />
          <h1 className="mt-1 font-mono text-base font-semibold truncate">{inv.codigo}</h1>
        </div>
      }
      queue={
        <RRHHQueue
          viewerId={viewer.userId}
          active={{ kind: 'invitacion', id: inv.id }}
          bucket="invitaciones"
        />
      }
      main={
        <ItemForm
          title={`Invitación ${inv.codigo}`}
          subtitle={
            inv.creado_por_nombre
              ? `Creada por ${inv.creado_por_nombre} · ${formatFechaHora(inv.created_at)}`
              : `Creada ${formatFechaHora(inv.created_at)}`
          }
          badges={
            <Badge variant={ESTADO_VARIANT[inv.estado]}>{ESTADO_LABEL[inv.estado]}</Badge>
          }
          fields={
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border border-border bg-card p-6 text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Código
                </p>
                <p className="mt-2 font-mono text-3xl font-bold tracking-[0.4em] text-foreground">
                  {inv.codigo}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Expira el {formatFechaLarga(inv.expira_en)}
                  {inv.estado === 'disponible' ? ` (${expiraDias} días)` : ''}
                </p>
              </div>

              {inv.notas ? (
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Notas internas
                  </h3>
                  <p className="rounded-md border border-border bg-card p-3 text-sm">
                    {inv.notas}
                  </p>
                </div>
              ) : null}
            </div>
          }
          activity={
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Acciones
              </h3>
              <InvitacionActions
                invitacionId={inv.id}
                codigo={inv.codigo}
                estado={inv.estado}
              />
            </div>
          }
        />
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'flujo',
              title: 'Cómo se usa',
              children: (
                <ol className="list-decimal space-y-1.5 pl-4 text-xs text-muted-foreground">
                  <li>Comparte el código con el candidato.</li>
                  <li>Él lo captura en la pantalla de registro de la app provider.</li>
                  <li>Al registrarse el código queda como "usada".</li>
                  <li>Inicia su ciclo de carga de documentos.</li>
                </ol>
              ),
            },
          ]}
        />
      }
    />
  );
}
