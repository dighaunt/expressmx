import type { Metadata } from 'next';
import Link from 'next/link';
import { Books, Plus } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { SoporteQueue } from '@/components/dashboard/soporte-queue';
import {
  ContextSidebar,
  KbSearch,
  WorkspaceShell,
} from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { listKbArticles } from '@/lib/dashboard/queries/kb';
import {
  AUDIENCIA_LABEL,
  type AudienciaKb,
} from '@/lib/dashboard/kb-shared';
import { CATEGORIA_LABEL, TIER_LABEL } from '@/lib/dashboard/tickets-shared';
import { formatFechaHora } from '@/lib/dashboard/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Base de conocimiento · Soporte · ExpressMX' };

interface SearchParams {
  q?: string;
  categoria?: string;
  audiencia?: string;
  publicado?: string;
}

const AUDIENCIA_VALIDA = new Set<AudienciaKb>([
  'cliente',
  'agente_l1',
  'agente_l2_l3',
  'admin',
]);

export default async function KbListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requirePermiso('soporte.kb.ver');
  const sp = await searchParams;

  const audienciaParam =
    sp.audiencia && AUDIENCIA_VALIDA.has(sp.audiencia as AudienciaKb)
      ? (sp.audiencia as AudienciaKb)
      : undefined;
  const publicadosSolo = sp.publicado !== 'todos';
  const puedeEditar = tienePermiso(viewer, 'soporte.kb.editar');

  const { articles } = await listKbArticles({
    publicadosSolo,
    categoria: sp.categoria ?? null,
    ...(audienciaParam ? { audiencia: audienciaParam } : {}),
    ...(sp.q ? { q: sp.q } : {}),
    limit: 60,
  });

  return (
    <WorkspaceShell
      header={
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Workspace · Soporte
            </p>
            <h1 className="text-base font-semibold">Base de conocimiento</h1>
          </div>
          {puedeEditar ? (
            <Link
              href="/dashboard/soporte/kb/nuevo"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus size={14} aria-hidden /> Nuevo artículo
            </Link>
          ) : null}
        </div>
      }
      queue={<SoporteQueue viewer={viewer} active={{ kind: 'ninguno' }} bucket="mis" />}
      main={
        <div className="space-y-6">
          <KbSearch
            q={sp.q}
            hrefBase="/dashboard/soporte/kb/articulo"
          />
          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Artículos {publicadosSolo ? 'publicados' : '(incluye borradores)'}
              </h2>
              <div className="flex flex-wrap gap-1.5">
                <Link
                  href={publicadosSolo ? '?publicado=todos' : '?'}
                  className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted"
                >
                  {publicadosSolo ? 'Ver todos' : 'Solo publicados'}
                </Link>
              </div>
            </div>
            {articles.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                No hay artículos para los filtros aplicados.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {articles.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/dashboard/soporte/kb/articulo/${a.slug}`}
                      className="block rounded-md border border-border bg-card p-3 hover:border-primary/40 hover:bg-muted/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm">{a.titulo}</p>
                          {a.resumen ? (
                            <p className="line-clamp-2 text-xs text-muted-foreground">
                              {a.resumen}
                            </p>
                          ) : null}
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Actualizado {formatFechaHora(a.updated_at)} · {a.helpful_count} útil ·{' '}
                            {a.view_count} vistas
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          {!a.publicado ? <Badge variant="muted">Borrador</Badge> : null}
                          {a.categoria ? (
                            <Badge variant="outline">
                              {CATEGORIA_LABEL[a.categoria as keyof typeof CATEGORIA_LABEL] ??
                                a.categoria}
                            </Badge>
                          ) : null}
                          <Badge variant="outline">{TIER_LABEL[a.tier_minimo]}</Badge>
                        </div>
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
              key: 'audiencias',
              title: 'Audiencias',
              children: (
                <div className="space-y-1">
                  {(Object.keys(AUDIENCIA_LABEL) as AudienciaKb[]).map((a) => {
                    const isActive = audienciaParam === a;
                    const params = new URLSearchParams();
                    if (sp.q) params.set('q', sp.q);
                    if (!isActive) params.set('audiencia', a);
                    if (sp.categoria) params.set('categoria', sp.categoria);
                    if (!publicadosSolo) params.set('publicado', 'todos');
                    return (
                      <Link
                        key={a}
                        href={`?${params.toString()}`}
                        className={
                          isActive
                            ? 'block rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground'
                            : 'block rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted'
                        }
                      >
                        {AUDIENCIA_LABEL[a]}
                      </Link>
                    );
                  })}
                </div>
              ),
            },
            {
              key: 'tip',
              title: 'Sugerencia',
              children: (
                <p className="text-xs text-muted-foreground">
                  <Books size={12} aria-hidden className="-mt-0.5 mr-1 inline" /> Los artículos
                  marcados como tier L1 son los más usados por agentes de primer nivel.
                </p>
              ),
            },
          ]}
        />
      }
    />
  );
}
