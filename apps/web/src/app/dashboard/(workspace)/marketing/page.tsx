import type { Metadata } from 'next';
import Link from 'next/link';
import { Megaphone, Plus } from '@phosphor-icons/react/ssr';
import { EmptyState } from '@/components/dashboard/empty-state';
import { MarketingQueue } from '@/components/dashboard/marketing-queue';
import { ContextSidebar, WorkspaceShell, WorkspaceTools } from '@/components/workspace';
import { ForbiddenError } from '@/lib/errors/http-errors';
import { requireViewer } from '@/lib/dashboard/auth-gate';
import { tieneAlgunPermiso, tienePermiso } from '@/lib/dashboard/rbac';
import type { MarketingBucket } from '@/lib/dashboard/queries/marketing-workspace';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Marketing · ExpressMX' };

interface SearchParams {
  bucket?: string;
}

export default async function MarketingHomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requireViewer();
  if (!tieneAlgunPermiso(viewer, ['cupones.gestionar', 'banners.gestionar'])) {
    throw new ForbiddenError('No tienes permisos de marketing');
  }
  const sp = await searchParams;
  const bucket = (sp.bucket ?? 'cupones_activos') as MarketingBucket;

  const puedeCrearCupon = tienePermiso(viewer, 'cupones.gestionar');
  const puedeCrearBanner = tienePermiso(viewer, 'banners.gestionar');

  return (
    <WorkspaceShell
      header={
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Workspace
            </p>
            <h1 className="text-base font-semibold">Marketing</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {puedeCrearCupon ? (
              <Link
                href="/dashboard/cupones/nuevo"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
              >
                <Plus size={14} aria-hidden /> Cupón
              </Link>
            ) : null}
            {puedeCrearBanner ? (
              <Link
                href="/dashboard/banners/nuevo"
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus size={14} aria-hidden /> Banner
              </Link>
            ) : null}
          </div>
        </div>
      }
      queue={<MarketingQueue active={{ kind: 'ninguno' }} bucket={bucket} />}
      main={
        <EmptyState
          icon={Megaphone}
          title="Selecciona un cupón o banner"
          description="Acciones (pausar, extender, detener) y métricas de uso aparecen aquí cuando abras un item."
        />
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'herramientas',
              title: 'Herramientas de marketing',
              children: <WorkspaceTools viewer={viewer} groups={['marketing']} compact />,
            },
            {
              key: 'consejo',
              title: 'Consejo',
              children: (
                <p className="text-xs text-muted-foreground">
                  Para apagar una promoción sin eliminarla del histórico, usa "detener" en
                  el cupón o "pausar" en el banner. Eliminar solo conviene si nunca llegó
                  a usarse.
                </p>
              ),
            },
            {
              key: 'segmentos',
              title: 'Segmentos disponibles (banners)',
              children: (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>· <strong>todos</strong> — toda la base.</li>
                  <li>· <strong>nuevos</strong> — sin órdenes completadas.</li>
                  <li>· <strong>recurrentes</strong> — con 1+ órdenes completadas.</li>
                </ul>
              ),
            },
          ]}
        />
      }
    />
  );
}
