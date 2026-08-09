import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { KbArticleForm } from '@/components/dashboard/kb-article-form';
import { SoporteQueue } from '@/components/dashboard/soporte-queue';
import {
  ContextSidebar,
  ItemForm,
  WorkspaceBreadcrumbs,
  WorkspaceShell,
} from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { getKbArticleBySlug } from '@/lib/dashboard/queries/kb';
import type { CategoriaTicket } from '@/lib/dashboard/tickets-shared';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Editar artículo · KB · ExpressMX' };

export default async function KbArticleEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const viewer = await requirePermiso('soporte.kb.editar');
  const { slug } = await params;
  const article = await getKbArticleBySlug(slug);
  if (!article) notFound();

  const puedePublicar = tienePermiso(viewer, 'soporte.kb.publicar');

  return (
    <WorkspaceShell
      accent="soporte"
      header={
        <div className="min-w-0">
          <WorkspaceBreadcrumbs
            items={[
              { label: 'Soporte', href: '/dashboard/soporte' },
              { label: 'KB', href: '/dashboard/soporte/kb' },
              {
                label: article.titulo,
                href: `/dashboard/soporte/kb/articulo/${article.slug}`,
              },
              { label: 'Editar' },
            ]}
          />
          <h1 className="mt-1 text-base font-semibold truncate">Editar artículo</h1>
        </div>
      }
      queue={<SoporteQueue viewer={viewer} active={{ kind: 'ninguno' }} bucket="mis" />}
      main={
        <ItemForm
          title="Editar artículo"
          subtitle={article.titulo}
          fields={
            <KbArticleForm
              mode="editar"
              puedePublicar={puedePublicar}
              initial={{
                id: article.id,
                titulo: article.titulo,
                resumen: article.resumen ?? '',
                contenido_md: article.contenido_md,
                categoria: (article.categoria as CategoriaTicket | null) ?? null,
                tipo_aplica: article.tipo_aplica,
                audiencia: article.audiencia,
                tier_minimo: article.tier_minimo,
                publicado: article.publicado,
              }}
            />
          }
        />
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'tip',
              title: 'Tip',
              children: (
                <p className="text-xs text-muted-foreground">
                  Cada cambio incrementa la versión y guarda historial. Publicar requiere
                  permiso adicional.
                </p>
              ),
            },
          ]}
        />
      }
    />
  );
}
