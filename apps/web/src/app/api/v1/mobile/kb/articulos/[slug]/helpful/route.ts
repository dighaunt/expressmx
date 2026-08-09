import { NextResponse } from 'next/server';
import { query, queryOne } from '@expressmx/database';
import { mobileKbHelpfulSchema } from '@expressmx/validations';
import { withApiHandler } from '@/lib/api/handler';
import { requireSession } from '@/lib/auth/mobile';
import { NotFoundError } from '@/lib/errors/http-errors';

interface ArticuloIdRow {
  id: string;
}

export const POST = withApiHandler<{ slug: string }>(async (req, ctx) => {
  const session = await requireSession(req);
  const { slug } = await ctx.params;
  const body = mobileKbHelpfulSchema.parse(await req.json());

  const articulo = await queryOne<ArticuloIdRow>(
    `SELECT id FROM kb_articles
      WHERE slug = $1
        AND publicado = TRUE
        AND 'cliente' = ANY(audiencia)`,
    [slug],
  );

  if (!articulo) throw new NotFoundError('Artículo no encontrado');

  await query(
    `INSERT INTO kb_views (article_id, viewer_user_id, helpful, deflected)
     VALUES ($1, $2, $3, $4)`,
    [articulo.id, session.sub, body.helpful, body.deflected ?? null],
  );

  await query(
    `UPDATE kb_articles
        SET helpful_count = helpful_count + (CASE WHEN $1 THEN 1 ELSE 0 END),
            not_helpful_count = not_helpful_count + (CASE WHEN $1 THEN 0 ELSE 1 END)
      WHERE slug = $2`,
    [body.helpful, slug],
  );

  return NextResponse.json({ ok: true });
}, 'POST /api/v1/mobile/kb/articulos/[slug]/helpful');
