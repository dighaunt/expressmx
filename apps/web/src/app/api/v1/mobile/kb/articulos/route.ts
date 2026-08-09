import { NextResponse } from 'next/server';
import { query } from '@expressmx/database';
import { withApiHandler } from '@/lib/api/handler';

const TICKET_CATEGORIAS = new Set([
  'cobro_incorrecto',
  'no_show',
  'dano_propiedad',
  'queja_servicio',
  'otro',
]);

interface ArticuloListRow {
  id: string;
  slug: string;
  titulo: string;
  resumen: string | null;
  categoria: string;
  view_count: number;
  helpful_count: number;
}

export const GET = withApiHandler(async (req) => {
  const url = new URL(req.url);
  const categoriaRaw = url.searchParams.get('categoria');
  const q = url.searchParams.get('q');
  const limitRaw = url.searchParams.get('limit');

  const categoria = categoriaRaw && TICKET_CATEGORIAS.has(categoriaRaw) ? categoriaRaw : null;
  const search = q && q.trim().length > 0 ? q.trim() : null;
  const limit = (() => {
    const n = limitRaw ? Number.parseInt(limitRaw, 10) : 20;
    if (Number.isNaN(n)) return 20;
    return Math.min(Math.max(n, 1), 50);
  })();

  const rows = await query<ArticuloListRow>(
    `SELECT id, slug, titulo, resumen, categoria::text AS categoria,
            view_count, helpful_count
       FROM kb_articles
      WHERE publicado = TRUE
        AND 'cliente' = ANY(audiencia)
        AND ($1::cat_ticket IS NULL OR categoria = $1::cat_ticket)
        AND ($2::text IS NULL OR search_vector @@ websearch_to_tsquery('spanish', $2))
      ORDER BY
        CASE WHEN $2::text IS NOT NULL
             THEN ts_rank(search_vector, websearch_to_tsquery('spanish', $2))
             ELSE 0
        END DESC,
        view_count DESC
      LIMIT $3`,
    [categoria, search, limit],
  );

  return NextResponse.json({ data: rows });
}, 'GET /api/v1/mobile/kb/articulos');
