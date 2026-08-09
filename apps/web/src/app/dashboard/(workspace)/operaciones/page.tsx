import type { Metadata } from 'next';
import { ClipboardText } from '@phosphor-icons/react/ssr';
import { EmptyState } from '@/components/dashboard/empty-state';
import { OperacionesQueue } from '@/components/dashboard/operaciones-queue';
import { ContextSidebar, WorkspaceShell, WorkspaceTools } from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Operaciones · ExpressMX' };

interface SearchParams {
  bucket?: string;
}

export default async function OperacionesHomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requirePermiso('operaciones.ver');
  const sp = await searchParams;
  const bucket = (sp.bucket ?? 'sin_asignar') as
    | 'sin_asignar'
    | 'sla_riesgo'
    | 'en_curso'
    | 'completadas'
    | 'mias';

  return (
    <WorkspaceShell
      header={
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Workspace
            </p>
            <h1 className="text-base font-semibold">Operaciones</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Selecciona una orden de la cola para asignar prestador o cambiar estatus.
          </p>
        </div>
      }
      queue={
        <OperacionesQueue
          viewerId={viewer.userId}
          active={{ kind: 'ninguno' }}
          bucket={bucket}
        />
      }
      main={
        <EmptyState
          icon={ClipboardText}
          title="Selecciona una orden"
          description="Las acciones disponibles (asignar, reasignar, cancelar) y los prestadores cercanos aparecen aquí cuando abras una orden."
        />
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'herramientas',
              title: 'Herramientas operativas',
              children: <WorkspaceTools viewer={viewer} groups={['operaciones', 'catalogo']} compact />,
            },
            {
              key: 'sla',
              title: 'Política SLA',
              children: (
                <p className="text-xs text-muted-foreground">
                  Una orden en estatus <code className="font-mono text-[11px]">solicitada</code>{' '}
                  por más de 30 minutos entra al bucket "En riesgo SLA". Asígnala cuanto antes.
                </p>
              ),
            },
            {
              key: 'tip',
              title: 'Tip',
              children: (
                <p className="text-xs text-muted-foreground">
                  Los prestadores se ordenan automáticamente por: si ofrecen el servicio,
                  distancia a la dirección, y órdenes completadas.
                </p>
              ),
            },
          ]}
        />
      }
    />
  );
}
