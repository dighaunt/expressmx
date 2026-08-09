'use server';

import { revalidatePath } from 'next/cache';
import { query, queryOne, withTransaction } from '@expressmx/database';
import { logAccion, logAccionDirecta } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import type { AudienciaKb } from '@/lib/dashboard/kb-shared';
import type { CategoriaTicket, TierSoporte, TipoTicket } from '@/lib/dashboard/tickets-shared';

interface ActionResult<T = void> {
  ok: boolean;
  message?: string;
  data?: T;
}

export interface KbInput {
  titulo: string;
  resumen?: string | null;
  contenido_md: string;
  categoria?: CategoriaTicket | null;
  tipo_aplica?: ReadonlyArray<TipoTicket>;
  audiencia?: ReadonlyArray<AudienciaKb>;
  tier_minimo?: TierSoporte;
}

function validar(input: KbInput): string | null {
  if (!input.titulo || input.titulo.trim().length < 3) {
    return 'El título es muy corto';
  }
  if (!input.contenido_md || input.contenido_md.trim().length < 10) {
    return 'El contenido es muy corto';
  }
  if (input.titulo.length > 200) return 'El título es muy largo';
  if (input.contenido_md.length > 50000) return 'El contenido es muy largo';
  return null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

export async function crearKb(input: KbInput): Promise<ActionResult<{ id: string; slug: string }>> {
  const viewer = await requirePermiso('soporte.kb.editar');
  const err = validar(input);
  if (err) return { ok: false, message: err };

  const baseSlug = slugify(input.titulo);
  if (baseSlug.length === 0) return { ok: false, message: 'El título no es válido para slug' };

  let slug = baseSlug;
  let suffix = 1;
  while (true) {
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM kb_articles WHERE slug = $1`,
      [slug],
    );
    if (!existing) break;
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
    if (suffix > 100) return { ok: false, message: 'No pudimos generar un slug único' };
  }

  const row = await queryOne<{ id: string }>(
    `INSERT INTO kb_articles
       (slug, titulo, resumen, contenido_md, categoria, tipo_aplica, audiencia, tier_minimo, autor_id)
     VALUES (
       $1, $2, $3, $4,
       $5::cat_ticket,
       COALESCE($6::tipo_ticket[], '{}'),
       COALESCE($7::audiencia_kb[], '{cliente,agente_l1,agente_l2_l3}'),
       COALESCE($8::tier_soporte, 'l1'),
       $9
     )
     RETURNING id`,
    [
      slug,
      input.titulo.trim(),
      input.resumen?.trim() || null,
      input.contenido_md,
      input.categoria ?? null,
      input.tipo_aplica && input.tipo_aplica.length > 0 ? input.tipo_aplica : null,
      input.audiencia && input.audiencia.length > 0 ? input.audiencia : null,
      input.tier_minimo ?? null,
      viewer.userId,
    ],
  );
  if (!row) return { ok: false, message: 'No pudimos crear el artículo' };

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'kb.crear',
    entidad: 'kb_articles',
    entidadId: row.id,
    valorNuevo: { slug, titulo: input.titulo },
  });

  revalidatePath('/dashboard/soporte/kb');
  return { ok: true, data: { id: row.id, slug } };
}

export async function editarKb(
  id: string,
  input: KbInput,
): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.kb.editar');
  const err = validar(input);
  if (err) return { ok: false, message: err };

  return await withTransaction(async (tx) => {
    const existing = await tx.queryOne<{ slug: string; titulo: string }>(
      `SELECT slug, titulo FROM kb_articles WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!existing) return { ok: false, message: 'No encontramos el artículo' };

    await tx.query(
      `UPDATE kb_articles SET
         titulo = $1,
         resumen = $2,
         contenido_md = $3,
         categoria = $4::cat_ticket,
         tipo_aplica = COALESCE($5::tipo_ticket[], tipo_aplica),
         audiencia = COALESCE($6::audiencia_kb[], audiencia),
         tier_minimo = COALESCE($7::tier_soporte, tier_minimo),
         version = version + 1,
         updated_at = NOW()
       WHERE id = $8`,
      [
        input.titulo.trim(),
        input.resumen?.trim() || null,
        input.contenido_md,
        input.categoria ?? null,
        input.tipo_aplica && input.tipo_aplica.length > 0 ? input.tipo_aplica : null,
        input.audiencia && input.audiencia.length > 0 ? input.audiencia : null,
        input.tier_minimo ?? null,
        id,
      ],
    );

    await logAccion(tx, {
      adminId: viewer.userId,
      accion: 'kb.editar',
      entidad: 'kb_articles',
      entidadId: id,
      valorAnterior: { titulo: existing.titulo },
      valorNuevo: { titulo: input.titulo },
    });

    revalidatePath('/dashboard/soporte/kb');
    revalidatePath(`/dashboard/soporte/kb/articulo/${existing.slug}`);
    return { ok: true };
  });
}

export async function publicarKb(id: string): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.kb.publicar');
  const updated = await query<{ slug: string }>(
    `UPDATE kb_articles SET publicado = TRUE, publicado_en = COALESCE(publicado_en, NOW()), updated_at = NOW()
     WHERE id = $1
     RETURNING slug`,
    [id],
  );
  if (updated.length === 0) return { ok: false, message: 'No encontramos el artículo' };

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'kb.publicar',
    entidad: 'kb_articles',
    entidadId: id,
  });

  revalidatePath('/dashboard/soporte/kb');
  revalidatePath(`/dashboard/soporte/kb/articulo/${updated[0]!.slug}`);
  return { ok: true };
}

export async function despublicarKb(id: string): Promise<ActionResult> {
  const viewer = await requirePermiso('soporte.kb.publicar');
  const updated = await query<{ slug: string }>(
    `UPDATE kb_articles SET publicado = FALSE, updated_at = NOW()
     WHERE id = $1
     RETURNING slug`,
    [id],
  );
  if (updated.length === 0) return { ok: false, message: 'No encontramos el artículo' };

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'kb.despublicar',
    entidad: 'kb_articles',
    entidadId: id,
  });

  revalidatePath('/dashboard/soporte/kb');
  revalidatePath(`/dashboard/soporte/kb/articulo/${updated[0]!.slug}`);
  return { ok: true };
}
