import 'server-only';
import { query, queryOne } from '@expressmx/database';

export type EstatusZona = 'activa' | 'en_expansion' | 'suspendida';

export const ESTATUS_ZONA_LABEL: Record<EstatusZona, string> = {
  activa: 'Activa',
  en_expansion: 'En expansión',
  suspendida: 'Suspendida',
};

export interface ZonaRow {
  id: string;
  nombre: string;
  centro_lat: string;
  centro_lng: string;
  radio_km: string | null;
  estatus: EstatusZona;
  tarifas_count: number;
  prestadores_count: number;
}

export interface ZonaDetail extends ZonaRow {
  poligono_coords: unknown;
  created_at: string;
}

export interface TarifaZonaRow {
  id: string;
  servicio_id: string;
  servicio_nombre: string;
  categoria_nombre: string;
  tipo_ajuste: 'multiplicador' | 'monto_fijo';
  valor: string;
  vigencia_inicio: string;
  vigencia_fin: string | null;
  activa: boolean;
}

export async function listarZonas(): Promise<ZonaRow[]> {
  return query<ZonaRow>(
    `SELECT
       z.id, z.nombre, z.centro_lat, z.centro_lng, z.radio_km, z.estatus,
       (SELECT COUNT(*) FROM tarifas_zona t WHERE t.zona_id = z.id AND t.activa = TRUE)::INT AS tarifas_count,
       (SELECT COUNT(DISTINCT d.prestador_id)
          FROM disponibilidad_prestador d
          JOIN LATERAL public.zona_operativa_para_punto(d.zona_lat, d.zona_lng) zo ON TRUE
          WHERE zo.zona_id = z.id)::INT AS prestadores_count
     FROM zonas_cobertura z
     ORDER BY z.nombre`,
  );
}

export async function getZona(id: string): Promise<ZonaDetail | null> {
  return queryOne<ZonaDetail>(
    `SELECT
       z.id, z.nombre, z.centro_lat, z.centro_lng, z.radio_km, z.estatus,
       z.poligono_coords, z.created_at,
       (SELECT COUNT(*) FROM tarifas_zona t WHERE t.zona_id = z.id AND t.activa = TRUE)::INT AS tarifas_count,
       (SELECT COUNT(DISTINCT d.prestador_id)
          FROM disponibilidad_prestador d
          JOIN LATERAL public.zona_operativa_para_punto(d.zona_lat, d.zona_lng) zo ON TRUE
          WHERE zo.zona_id = z.id)::INT AS prestadores_count
     FROM zonas_cobertura z
     WHERE z.id = $1`,
    [id],
  );
}

export async function listarTarifasDeZona(zonaId: string): Promise<TarifaZonaRow[]> {
  return query<TarifaZonaRow>(
    `SELECT
       t.id, t.servicio_id, t.tipo_ajuste, t.valor,
       to_char(t.vigencia_inicio, 'YYYY-MM-DD') AS vigencia_inicio,
       to_char(t.vigencia_fin, 'YYYY-MM-DD') AS vigencia_fin,
       t.activa,
       s.nombre AS servicio_nombre,
       c.nombre AS categoria_nombre
     FROM tarifas_zona t
     JOIN servicios s ON s.id = t.servicio_id
     JOIN categorias_servicio c ON c.id = s.categoria_id
     WHERE t.zona_id = $1
     ORDER BY t.activa DESC, c.nombre, s.nombre`,
    [zonaId],
  );
}
