import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, PencilSimple } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { KbVoteButtons } from '@/components/dashboard/kb-vote-buttons';
import { SoporteQueue } from '@/components/dashboard/soporte-queue';
import {
  ContextSidebar,
  ItemForm,
  WorkspaceBreadcrumbs,
  WorkspaceShell,
} from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import {
  AUDIENCIA_LABEL,
  type AudienciaKb,
} from '@/lib/dashboard/kb-shared';
import {
  CATEGORIA_LABEL,
  TIER_LABEL,
  TIPO_TICKET_LABEL,
  type CategoriaTicket,
  type TipoTicket,
} from '@/lib/dashboard/tickets-shared';
import { getKbArticleBySlug } from '@/lib/dashboard/queries/kb';
import { registrarVistaKb } from '@/lib/dashboard/actions/kb-vote';
import { formatFechaHora } from '@/lib/dashboard/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Artículo · KB · ExpressMX' };

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ticket?: string }>;
}

export default async function KbArticlePage({ params, searchParams }: PageProps) {
  const viewer = await requirePermiso('soporte.kb.ver');
  const { slug } = await params;
  const sp = await searchParams;

  const article = await getKbArticleBySlug(slug);
  if (!article) notFound();

  if (sp.ticket) {
    try {
      await registrarVistaKb(article.id, sp.ticket);
    } catch {}
  }

  const puedeEditar = tienePermiso(viewer, 'soporte.kb.editar');

  return (
    <WorkspaceShell
      accent="soporte"
      header={
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <WorkspaceBreadcrumbs
              items={[
                { label: 'Soporte', href: '/dashboard/soporte' },
                { label: 'KB', href: '/dashboard/soporte/kb' },
                { label: article.titulo },
              ]}
            />
            <h1 className="mt-1 text-base font-semibold truncate">{article.titulo}</h1>
          </div>
          {puedeEditar ? (
            <Link
              href={`/dashboard/soporte/kb/articulo/${article.slug}/editar`}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              <PencilSimple size={14} aria-hidden /> Editar
            </Link>
          ) : null}
        </div>
      }
      queue={<SoporteQueue viewer={viewer} active={{ kind: 'ninguno' }} bucket="mis" />}
      main={
        <ItemForm
          title={article.titulo}
          {...(article.resumen ? { subtitle: article.resumen } : {})}
          badges={
            <>
              {!article.publicado ? <Badge variant="muted">Borrador</Badge> : (
                <Badge variant="success">Publicado</Badge>
              )}
              {article.categoria ? (
                <Badge variant="outline">
                  {CATEGORIA_LABEL[article.categoria as CategoriaTicket] ?? article.categoria}
                </Badge>
              ) : null}
              <Badge variant="outline">{TIER_LABEL[article.tier_minimo]}</Badge>
            </>
          }
          meta={
            <span>
              v{article.version} · actualizado {formatFechaHora(article.updated_at)} ·{' '}
              {article.view_count} vistas · {article.helpful_count} útil
            </span>
          }
          fields={
            <div className="space-y-4">
              <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-background p-4 text-sm leading-relaxed font-sans">
                {article.contenido_md}
              </pre>
              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <p className="text-xs text-muted-foreground">¿Te resolvió la duda?</p>
                <KbVoteButtons
                  articleId={article.id}
                  helpfulCount={article.helpful_count}
                  {...(sp.ticket ? { ticketId: sp.ticket } : {})}
                />
              </div>
            </div>
          }
          activity={
            <Link
              href="/dashboard/soporte/kb"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
            >
              <ArrowLeft size={12} aria-hidden /> Volver a la lista
            </Link>
          }
        />
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'meta',
              title: 'Aplicabilidad',
              children: (
                <div className="space-y-2 text-xs">
                  {article.tipo_aplica.length > 0 ? (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Tipos
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {article.tipo_aplica.map((t) => (
                          <Badge key={t} variant="outline">
                            {TIPO_TICKET_LABEL[t as TipoTicket] ?? t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Audiencia
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {article.audiencia.map((a) => (
                        <Badge key={a} variant="outline">
                          {AUDIENCIA_LABEL[a as AudienciaKb] ?? a}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {article.publicado_en ? (
                    <p className="text-muted-foreground">
                      Publicado {formatFechaHora(article.publicado_en)}
                    </p>
                  ) : null}
                </div>
              ),
            },
            ...(sp.ticket
              ? [
                  {
                    key: 'ticket',
                    title: 'Ticket vinculado',
                    children: (
                      <Link
                        href={`/dashboard/soporte/ticket/${sp.ticket}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Volver al ticket
                      </Link>
                    ),
                  },
                ]
              : []),
          ]}
        />
      }
    />
  );
}
