import 'server-only';
import { query, queryOne } from '@expressmx/database';
import { formatMoneda, formatNumero } from '@/lib/dashboard/format';

export interface MarketingQueueCounts {
  cupones_activos: number;
  cupones_por_expirar: number;
  banners_vigentes: number;
  banners_pausados: number;
}

export async function getMarketingQueueCounts(): Promise<MarketingQueueCounts> {
  const row = await queryOne<MarketingQueueCounts>(
    `SELECT
       (SELECT COUNT(*) FROM cupones
        WHERE fecha_inicio <= CURRENT_DATE
          AND fecha_expiracion >= CURRENT_DATE
          AND usos_actuales < usos_maximos)::INT AS cupones_activos,
       (SELECT COUNT(*) FROM cupones
        WHERE fecha_expiracion BETWEEN CURRENT_DATE
          AND CURRENT_DATE + INTERVAL '7 days'
          AND usos_actuales < usos_maximos)::INT AS cupones_por_expirar,
       (SELECT COUNT(*) FROM banners_promocionales
        WHERE activo = TRUE
          AND fecha_inicio <= CURRENT_DATE
          AND fecha_fin >= CURRENT_DATE)::INT AS banners_vigentes,
       (SELECT COUNT(*) FROM banners_promocionales
        WHERE activo = FALSE
           OR fecha_inicio > CURRENT_DATE
           OR fecha_fin < CURRENT_DATE)::INT AS banners_pausados`,
  );
  return (
    row ?? {
      cupones_activos: 0,
      cupones_por_expirar: 0,
      banners_vigentes: 0,
      banners_pausados: 0,
    }
  );
}

export type MarketingBucket =
  | 'cupones_activos'
  | 'cupones_por_expirar'
  | 'banners_vigentes'
  | 'banners_pausados';

export interface MarketingQueueItem {
  kind: 'cupon' | 'banner';
  id: string;
  primary: string;
  secondary: string;
  meta: string;
  badge?: string;
  ts: string;
}

interface CuponQueueRow {
  id: string;
  codigo: string;
  tipo_descuento: string;
  valor: string;
  fecha_inicio: string;
  fecha_expiracion: string;
  usos_actuales: number;
  usos_maximos: number;
  created_at: string;
}

interface BannerQueueRow {
  id: string;
  titulo: string;
  segmento: string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
  orden_prioridad: number;
  vigente: boolean;
  created_at: string;
}

export async function listarColaMarketing(
  bucket: MarketingBucket,
  limit = 30,
): Promise<MarketingQueueItem[]> {
  if (bucket === 'cupones_activos') {
    const rows = await query<CuponQueueRow>(
      `SELECT
         id, codigo, tipo_descuento::text AS tipo_descuento, valor::text AS valor,
         to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
         to_char(fecha_expiracion, 'YYYY-MM-DD') AS fecha_expiracion,
         usos_actuales, usos_maximos, NOW() AS created_at
       FROM cupones
       WHERE fecha_inicio <= CURRENT_DATE
         AND fecha_expiracion >= CURRENT_DATE
         AND usos_actuales < usos_maximos
       ORDER BY fecha_expiracion ASC
       LIMIT $1`,
      [limit],
    );
    return rows.map((r) => ({
      kind: 'cupon',
      id: r.id,
      primary: r.codigo,
      secondary:
        r.tipo_descuento === 'porcentaje'
          ? `${formatNumero(r.valor)}% de descuento`
          : `${formatMoneda(r.valor)} de descuento`,
      meta: `${formatNumero(r.usos_actuales)}/${formatNumero(r.usos_maximos)} usos · expira ${r.fecha_expiracion}`,
      badge: 'Activo',
      ts: r.created_at,
    }));
  }

  if (bucket === 'cupones_por_expirar') {
    const rows = await query<CuponQueueRow>(
      `SELECT
         id, codigo, tipo_descuento::text AS tipo_descuento, valor::text AS valor,
         to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
         to_char(fecha_expiracion, 'YYYY-MM-DD') AS fecha_expiracion,
         usos_actuales, usos_maximos, NOW() AS created_at
       FROM cupones
       WHERE fecha_expiracion BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
         AND usos_actuales < usos_maximos
       ORDER BY fecha_expiracion ASC
       LIMIT $1`,
      [limit],
    );
    return rows.map((r) => ({
      kind: 'cupon',
      id: r.id,
      primary: r.codigo,
      secondary:
        r.tipo_descuento === 'porcentaje'
          ? `${formatNumero(r.valor)}% de descuento`
          : `${formatMoneda(r.valor)} de descuento`,
      meta: `Expira ${r.fecha_expiracion}`,
      badge: 'Por expirar',
      ts: r.created_at,
    }));
  }

  const wherePart =
    bucket === 'banners_vigentes'
      ? `activo = TRUE AND fecha_inicio <= CURRENT_DATE AND fecha_fin >= CURRENT_DATE`
      : `activo = FALSE OR fecha_inicio > CURRENT_DATE OR fecha_fin < CURRENT_DATE`;

  const rows = await query<BannerQueueRow>(
    `SELECT
       id, titulo, segmento::text AS segmento,
       to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
       to_char(fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
       activo, orden_prioridad,
       (activo AND fecha_inicio <= CURRENT_DATE AND fecha_fin >= CURRENT_DATE) AS vigente,
       NOW() AS created_at
     FROM banners_promocionales
     WHERE ${wherePart}
     ORDER BY orden_prioridad ASC, fecha_fin DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    kind: 'banner',
    id: r.id,
    primary: r.titulo,
    secondary: `Segmento: ${r.segmento}`,
    meta: `${r.fecha_inicio} → ${r.fecha_fin} · prioridad ${r.orden_prioridad}`,
    badge: r.vigente ? 'Vigente' : !r.activo ? 'Pausado' : 'Fuera de vigencia',
    ts: r.created_at,
  }));
}
