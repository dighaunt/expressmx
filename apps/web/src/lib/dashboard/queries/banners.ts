import 'server-only';
import { query, queryOne } from '@expressmx/database';

export type SegmentoBanner = 'todos' | 'nuevos' | 'recurrentes';

export const SEGMENTO_LABEL: Record<SegmentoBanner, string> = {
  todos: 'Todos los clientes',
  nuevos: 'Nuevos clientes',
  recurrentes: 'Clientes recurrentes',
};

export interface BannerRow {
  id: string;
  titulo: string;
  imagen_url: string;
  url_destino: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  orden_prioridad: number;
  segmento: SegmentoBanner;
  activo: boolean;
  vigente: boolean;
}

export async function listarBanners(): Promise<BannerRow[]> {
  return query<BannerRow>(
    `SELECT
       id, titulo, imagen_url, url_destino,
       to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
       to_char(fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
       orden_prioridad, segmento, activo,
       (activo AND fecha_inicio <= CURRENT_DATE AND fecha_fin >= CURRENT_DATE) AS vigente
     FROM banners_promocionales
     ORDER BY activo DESC, orden_prioridad ASC, fecha_fin DESC`,
  );
}

export async function getBanner(id: string): Promise<BannerRow | null> {
  return queryOne<BannerRow>(
    `SELECT
       id, titulo, imagen_url, url_destino,
       to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
       to_char(fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
       orden_prioridad, segmento, activo,
       (activo AND fecha_inicio <= CURRENT_DATE AND fecha_fin >= CURRENT_DATE) AS vigente
     FROM banners_promocionales
     WHERE id = $1`,
    [id],
  );
}
