import type { Metadata } from 'next';
import Link from 'next/link';
import { FileMagnifyingGlass, Plus } from '@phosphor-icons/react/ssr';
import { EmptyState } from '@/components/dashboard/empty-state';
import { RRHHQueue } from '@/components/dashboard/rrhh-queue';
import { ContextSidebar, WorkspaceShell, WorkspaceTools } from '@/components/workspace';
import { ForbiddenError } from '@/lib/errors/http-errors';
import { requireViewer } from '@/lib/dashboard/auth-gate';
import { tieneAlgunPermiso, tienePermiso } from '@/lib/dashboard/rbac';
import type { RRHHBucket } from '@/lib/dashboard/queries/rrhh-workspace';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'RRHH · ExpressMX' };

interface SearchParams {
  bucket?: string;
}

export default async function RRHHHomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requireViewer();
  if (
    !tieneAlgunPermiso(viewer, [
      'prestadores.revisar_docs',
      'prestadores.invitar',
      'prestadores.aprobar',
    ])
  ) {
    throw new ForbiddenError('No tienes permisos de RRHH');
  }

  const sp = await searchParams;
  const bucket = (sp.bucket ?? 'docs_pendientes') as RRHHBucket;
  const puedeInvitar = tienePermiso(viewer, 'prestadores.invitar');

  return (
    <WorkspaceShell
      header={
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Workspace
            </p>
            <h1 className="text-base font-semibold">RRHH</h1>
          </div>
          {puedeInvitar ? (
            <Link
              href="/dashboard/invitaciones/nueva"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus size={14} aria-hidden /> Generar invitación
            </Link>
          ) : null}
        </div>
      }
      queue={
        <RRHHQueue
          viewerId={viewer.userId}
          active={{ kind: 'ninguno' }}
          bucket={bucket}
        />
      }
      main={
        <EmptyState
          icon={FileMagnifyingGlass}
          title="Selecciona un documento, invitación o prestador"
          description="Las acciones disponibles (aprobar, rechazar, revocar) y el contexto del prestador aparecen aquí cuando abras un item de la cola."
        />
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'herramientas',
              title: 'Herramientas de RRHH',
              children: <WorkspaceTools viewer={viewer} groups={['rrhh']} compact />,
            },
            {
              key: 'flujo',
              title: 'Flujo de onboarding',
              children: (
                <ol className="list-decimal space-y-1.5 pl-4 text-xs text-muted-foreground">
                  <li>Generas invitación → entregas código al candidato.</li>
                  <li>Candidato se registra en la app provider con ese código.</li>
                  <li>Candidato sube sus documentos → entran a tu cola.</li>
                  <li>Tú revisas, apruebas o rechazas con motivo.</li>
                  <li>Cuando todos sus documentos están aprobados puede recibir órdenes.</li>
                </ol>
              ),
            },
            {
              key: 'sla',
              title: 'SLA documental',
              children: (
                <p className="text-xs text-muted-foreground">
                  Política recomendada: revisar documentos pendientes en menos de 24h
                  para no bloquear el onboarding.
                </p>
              ),
            },
          ]}
        />
      }
    />
  );
}
