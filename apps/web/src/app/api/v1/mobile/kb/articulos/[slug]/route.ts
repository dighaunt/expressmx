import { NextResponse } from 'next/server';
import { query, queryOne } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';
import { getMobileSession } from '@/lib/auth/mobile';
import { NotFoundError } from '@/lib/errors/http-errors';

interface ArticuloRow {
  id: string;
  slug: string;
  titulo: string;
  contenido_md: string;
  resumen: string | null;
  categoria: string;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  audiencia: string[];
  publicado: boolean;
}

export const GET = withApiHandler<{ slug: string }>(async (req, ctx) => {
  const { slug } = await ctx.params;

  const articulo = await queryOne<ArticuloRow>(
    `UPDATE kb_articles
        SET view_count = view_count + 1
      WHERE slug = $1
        AND publicado = TRUE
        AND 'cliente' = ANY(audiencia)
      RETURNING id, slug, titulo, contenido_md, resumen,
                categoria::text AS categoria,
                view_count, helpful_count, not_helpful_count,
                audiencia, publicado`,
    [slug],
  );

  if (!articulo) throw new NotFoundError('Artículo no encontrado');

  let viewerUserId: string | null = null;
  try {
    const session = await getMobileSession(req);
    viewerUserId = session?.sub ?? null;
  } catch {
    viewerUserId = null;
  }

  await query(
    `INSERT INTO kb_views (article_id, viewer_user_id, session_id)
     VALUES ($1, $2, NULL)`,
    [articulo.id, viewerUserId],
  );

  return NextResponse.json({
    data: {
      id: articulo.id,
      slug: articulo.slug,
      titulo: articulo.titulo,
      contenido_md: articulo.contenido_md,
      resumen: articulo.resumen,
      categoria: articulo.categoria,
      view_count: articulo.view_count,
      helpful_count: articulo.helpful_count,
      not_helpful_count: articulo.not_helpful_count,
    },
  });
}, 'GET /api/v1/mobile/kb/articulos/[slug]');
