import 'server-only';
import { query } from '@expressmx/database';
import type { CannedResponseSummary } from '@/lib/dashboard/canned-shared';

interface ListOpts {
  categoria?: string | null;
  tipo?: string | null;
  scopeGrupo?: string | null;
  limit?: number;
}

export async function listCannedResponses(
  opts: ListOpts = {},
): Promise<CannedResponseSummary[]> {
  const where: string[] = ['activo = TRUE'];
  const args: unknown[] = [];

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
  if (opts.scopeGrupo) {
    args.push(opts.scopeGrupo);
    where.push(`(scope_grupo IS NULL OR scope_grupo = $${args.length})`);
  }

  args.push(opts.limit ?? 50);
  return query<CannedResponseSummary>(
    `SELECT
       id,
       slug,
       titulo,
       contenido_md,
       categoria::text AS categoria,
       tipo_aplica,
       variables_disponibles,
       uso_count
     FROM canned_responses
     WHERE ${where.join(' AND ')}
     ORDER BY uso_count DESC, titulo ASC
     LIMIT $${args.length}`,
    args,
  );
}

export async function incrementarUsoCanned(id: string): Promise<void> {
  await query(
    `UPDATE canned_responses SET uso_count = uso_count + 1, updated_at = NOW() WHERE id = $1`,
    [id],
  );
}
