'use server';

import { revalidatePath } from 'next/cache';
import { query, queryOne } from '@expressmx/database';
import { logAccionDirecta } from '@/lib/dashboard/audit';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

interface ActionResult {
  ok: boolean;
  message?: string;
  id?: string;
}

export interface BannerInput {
  titulo: string;
  imagen_url: string;
  url_destino: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  orden_prioridad: number;
  segmento: 'todos' | 'nuevos' | 'recurrentes';
  activo: boolean;
}

const DESTINO_INTERNO = /^\/[a-z0-9/_?=&.%+-]*$/i;
const DESTINO_DEEP_LINK = /^expressmx:\/\/[a-z0-9/_?=&.%+-]*$/i;

function validar(input: BannerInput): string | null {
  if (!input.titulo.trim()) return 'El título es obligatorio';
  if (input.titulo.length > 120) return 'El título es muy largo';
  if (!input.imagen_url.trim()) return 'La URL de la imagen es obligatoria';
  if (!/^https?:\/\//.test(input.imagen_url)) return 'La URL debe empezar con http(s)://';
  const destino = input.url_destino?.trim();
  if (
    destino &&
    !/^https?:\/\//.test(destino) &&
    !DESTINO_INTERNO.test(destino) &&
    !DESTINO_DEEP_LINK.test(destino)
  ) {
    return 'El destino debe ser http(s)://, expressmx:// o una ruta interna como /services';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha_inicio)) return 'Fecha de inicio inválida';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha_fin)) return 'Fecha de fin inválida';
  if (new Date(input.fecha_fin).getTime() < new Date(input.fecha_inicio).getTime()) {
    return 'La fecha de fin debe ser posterior o igual al inicio';
  }
  if (!Number.isInteger(input.orden_prioridad) || input.orden_prioridad < 0) {
    return 'El orden debe ser un entero >= 0';
  }
  return null;
}

export async function crearBanner(input: BannerInput): Promise<ActionResult> {
  const viewer = await requirePermiso('banners.gestionar');
  const error = validar(input);
  if (error) return { ok: false, message: error };

  const created = await queryOne<{ id: string }>(
    `INSERT INTO banners_promocionales
       (titulo, imagen_url, url_destino, fecha_inicio, fecha_fin,
        orden_prioridad, segmento, activo, creado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7::segmento_banner, $8, $9)
     RETURNING id`,
    [
      input.titulo.trim(),
      input.imagen_url.trim(),
      input.url_destino?.trim() || null,
      input.fecha_inicio,
      input.fecha_fin,
      input.orden_prioridad,
      input.segmento,
      input.activo,
      viewer.userId,
    ],
  );
  if (!created) return { ok: false, message: 'No pudimos crear el banner' };

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'banner.creado',
    entidad: 'banners_promocionales',
    entidadId: created.id,
    valorNuevo: input,
  });

  revalidatePath('/dashboard/banners');
  return { ok: true, id: created.id };
}

export async function actualizarBanner(id: string, input: BannerInput): Promise<ActionResult> {
  const viewer = await requirePermiso('banners.gestionar');
  const error = validar(input);
  if (error) return { ok: false, message: error };

  const updated = await query<{ id: string }>(
    `UPDATE banners_promocionales SET
       titulo = $1, imagen_url = $2, url_destino = $3,
       fecha_inicio = $4, fecha_fin = $5,
       orden_prioridad = $6, segmento = $7::segmento_banner, activo = $8
     WHERE id = $9
     RETURNING id`,
    [
      input.titulo.trim(),
      input.imagen_url.trim(),
      input.url_destino?.trim() || null,
      input.fecha_inicio,
      input.fecha_fin,
      input.orden_prioridad,
      input.segmento,
      input.activo,
      id,
    ],
  );
  if (updated.length === 0) return { ok: false, message: 'No encontramos el banner' };

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'banner.actualizado',
    entidad: 'banners_promocionales',
    entidadId: id,
    valorNuevo: input,
  });

  revalidatePath('/dashboard/banners');
  revalidatePath(`/dashboard/banners/${id}`);
  return { ok: true };
}

export async function eliminarBanner(id: string): Promise<ActionResult> {
  const viewer = await requirePermiso('banners.gestionar');
  await query(`DELETE FROM banners_promocionales WHERE id = $1`, [id]);

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: 'banner.eliminado',
    entidad: 'banners_promocionales',
    entidadId: id,
  });

  revalidatePath('/dashboard/banners');
  return { ok: true };
}

export async function toggleBanner(id: string, activo: boolean): Promise<ActionResult> {
  const viewer = await requirePermiso('banners.gestionar');
  await query(`UPDATE banners_promocionales SET activo = $1 WHERE id = $2`, [activo, id]);

  await logAccionDirecta({
    adminId: viewer.userId,
    accion: activo ? 'banner.reactivado' : 'banner.pausado',
    entidad: 'banners_promocionales',
    entidadId: id,
    valorNuevo: { activo },
  });

  revalidatePath('/dashboard/banners');
  return { ok: true };
}
