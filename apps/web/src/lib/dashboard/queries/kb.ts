import 'server-only';
import { query, queryOne } from '@expressmx/database';
import type { AudienciaKb, KbArticleFull, KbArticleSummary } from '@/lib/dashboard/kb-shared';
import type { TierSoporte } from '@/lib/dashboard/tickets-shared';

const TIER_RANK: Record<TierSoporte, number> = { l1: 1, l2: 2, l3: 3 };

interface BuscarOpts {
  texto: string;
  categoria?: string | null;
  tipo?: string | null;
  audiencia?: ReadonlyArray<AudienciaKb>;
  tierMinimo?: TierSoporte;
  limit?: number;
}

const BASE_SUMMARY_FIELDS = `
  id,
  slug,
  titulo,
  resumen,
  categoria::text AS categoria,
  tipo_aplica,
  audiencia,
  tier_minimo::text AS tier_minimo,
  publicado,
  view_count,
  helpful_count,
  updated_at`;

const BASE_FULL_FIELDS = `${BASE_SUMMARY_FIELDS},
  contenido_md,
  version,
  publicado_en`;

export async function buscarKb(opts: BuscarOpts): Promise<KbArticleSummary[]> {
  const where: string[] = ['publicado = TRUE'];
  const args: unknown[] = [];

  const texto = opts.texto.trim();
  if (texto.length === 0) return [];

  args.push(texto);
  where.push(`search_vector @@ plainto_tsquery('spanish', $${args.length})`);

  if (opts.categoria) {
    args.push(opts.categoria);
    where.push(`(categoria IS NULL OR categoria = $${args.length}::cat_ticket)`);
  }
  if (opts.tipo) {
    args.push(opts.tipo);
    where.push(
      `(cardinality(tipo_aplica) = 0 OR $${args.length}::tipo_ticket = ANY(tipo_aplica))`,
    );
  }
  if (opts.audiencia && opts.audiencia.length > 0) {
    args.push(opts.audiencia);
    where.push(`audiencia && $${args.length}::audiencia_kb[]`);
  }
  if (opts.tierMinimo) {
    args.push(TIER_RANK[opts.tierMinimo]);
    where.push(
      `(CASE tier_minimo WHEN 'l1' THEN 1 WHEN 'l2' THEN 2 ELSE 3 END) <= $${args.length}`,
    );
  }

  args.push(opts.limit ?? 10);
  return query<KbArticleSummary>(
    `SELECT ${BASE_SUMMARY_FIELDS},
       ts_rank_cd(search_vector, plainto_tsquery('spanish', $1)) AS rank
     FROM kb_articles
     WHERE ${where.join(' AND ')}
     ORDER BY rank DESC, view_count DESC
     LIMIT $${args.length}`,
    args,
  );
}

export async function getKbArticleBySlug(slug: string): Promise<KbArticleFull | null> {
  return queryOne<KbArticleFull>(
    `SELECT ${BASE_FULL_FIELDS}
     FROM kb_articles
     WHERE slug = $1`,
    [slug],
  );
}

export async function getKbArticleById(id: string): Promise<KbArticleFull | null> {
  return queryOne<KbArticleFull>(
    `SELECT ${BASE_FULL_FIELDS}
     FROM kb_articles
     WHERE id = $1`,
    [id],
  );
}

interface ListOpts {
  publicadosSolo?: boolean;
  categoria?: string | null;
  audiencia?: AudienciaKb;
  q?: string;
  limit?: number;
  offset?: number;
}

export async function listKbArticles(
  opts: ListOpts = {},
): Promise<{ articles: KbArticleSummary[]; total: number }> {
  const where: string[] = [];
  const args: unknown[] = [];

  if (opts.publicadosSolo) {
    where.push(`publicado = TRUE`);
  }
  if (opts.categoria) {
    args.push(opts.categoria);
    where.push(`categoria = $${args.length}::cat_ticket`);
  }
  if (opts.audiencia) {
    args.push([opts.audiencia]);
    where.push(`audiencia && $${args.length}::audiencia_kb[]`);
  }
  if (opts.q && opts.q.trim()) {
    args.push(`%${opts.q.trim().toLowerCase()}%`);
    where.push(`(LOWER(titulo) LIKE $${args.length} OR LOWER(COALESCE(resumen, '')) LIKE $${args.length})`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*) AS total FROM kb_articles ${whereSql}`,
    args,
  );

  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  args.push(limit, offset);

  const articles = await query<KbArticleSummary>(
    `SELECT ${BASE_SUMMARY_FIELDS}
     FROM kb_articles
     ${whereSql}
     ORDER BY publicado DESC, updated_at DESC
     LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );

  return { articles, total: Number(totalRow?.total ?? 0) };
}

interface SugerenciaOpts {
  asunto: string;
  categoria?: string | null;
  tipo?: string | null;
  limit?: number;
}

export async function getKbSugerencias(opts: SugerenciaOpts): Promise<KbArticleSummary[]> {
  const texto = opts.asunto.trim();
  if (texto.length < 3) return [];

  const where: string[] = ['publicado = TRUE'];
  const args: unknown[] = [texto];
  where.push(`search_vector @@ plainto_tsquery('spanish', $1)`);

  if (opts.categoria) {
    args.push(opts.categoria);
    where.push(`(categoria IS NULL OR categoria = $${args.length}::cat_ticket)`);
  }
  if (opts.tipo) {
    args.push(opts.tipo);
    where.push(
      `(cardinality(tipo_aplica) = 0 OR $${args.length}::tipo_ticket = ANY(tipo_aplica))`,
    );
  }

  args.push(opts.limit ?? 5);
  return query<KbArticleSummary>(
    `SELECT ${BASE_SUMMARY_FIELDS},
       ts_rank_cd(search_vector, plainto_tsquery('spanish', $1)) AS rank
     FROM kb_articles
     WHERE ${where.join(' AND ')}
     ORDER BY rank DESC, view_count DESC
     LIMIT $${args.length}`,
    args,
  );
}
