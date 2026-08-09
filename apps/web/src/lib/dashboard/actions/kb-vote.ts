'use server';

import { revalidatePath } from 'next/cache';
import { withTransaction } from '@expressmx/database';
import { logAccion } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

interface ActionResult {
  ok: boolean;
  message?: string;
}

export async function votarKb(
  articleId: string,
  helpful: boolean,
  ticketId?: string | null,
): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.kb.ver');

  return await withTransaction(async (tx) => {
    const existing = await tx.queryOne<{ slug: string }>(
      `SELECT slug FROM kb_articles WHERE id = $1`,
      [articleId],
    );
    if (!existing) return { ok: false, message: 'No encontramos el artículo' };

    await tx.query(
      `INSERT INTO kb_views (article_id, viewer_user_id, ticket_id, helpful)
       VALUES ($1, $2, $3, $4)`,
      [articleId, viewer.userId, ticketId ?? null, helpful],
    );

    if (helpful) {
      await tx.query(
        `UPDATE kb_articles SET helpful_count = helpful_count + 1, updated_at = NOW() WHERE id = $1`,
        [articleId],
      );
    } else {
      await tx.query(
        `UPDATE kb_articles SET not_helpful_count = not_helpful_count + 1, updated_at = NOW() WHERE id = $1`,
        [articleId],
      );
    }

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: helpful ? 'kb.voto_util' : 'kb.voto_no_util',
      entidad: 'kb_articles',
      entidadId: articleId,
      ticketId: ticketId ?? null,
    });

    revalidatePath(`/dashboard/soporte/kb/articulo/${existing.slug}`);
    return { ok: true };
  });
}

export async function registrarVistaKb(
  articleId: string,
  ticketId?: string | null,
): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.kb.ver');

  return await withTransaction(async (tx) => {
    const existing = await tx.queryOne<{ id: string }>(
      `SELECT id FROM kb_articles WHERE id = $1`,
      [articleId],
    );
    if (!existing) return { ok: false, message: 'No encontramos el artículo' };

    await tx.query(
      `INSERT INTO kb_views (article_id, viewer_user_id, ticket_id)
       VALUES ($1, $2, $3)`,
      [articleId, viewer.userId, ticketId ?? null],
    );
    await tx.query(
      `UPDATE kb_articles SET view_count = view_count + 1 WHERE id = $1`,
      [articleId],
    );
    return { ok: true };
  });
}
