import 'server-only';
import { queryOne } from '@expressmx/database';
import type { TierSoporte } from '@/lib/dashboard/tickets-shared';

export interface CasoDetalle {
  id: string;
  agente_id: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_apellidos: string;
  cliente_email: string;
  cliente_telefono: string | null;
  cliente_avatar_url: string | null;
  abierto_en: string;
  expira_en: string;
  cerrado_en: string | null;
  motivo_cierre: string | null;
  ticket_id: string | null;
  ticket_tier_actual: TierSoporte | null;
  pin_id: string;
}

export async function getCasoDetalle(casoId: string): Promise<CasoDetalle | null> {
  return await queryOne<CasoDetalle>(
    `SELECT
       c.id,
       c.agente_id,
       c.cliente_id,
       u.nombre AS cliente_nombre,
       u.apellidos AS cliente_apellidos,
       u.email AS cliente_email,
       u.telefono AS cliente_telefono,
       u.avatar_url AS cliente_avatar_url,
       c.abierto_en,
       c.expira_en,
       c.cerrado_en,
       c.motivo_cierre,
       c.ticket_id,
       t.tier_actual::text AS ticket_tier_actual,
       c.pin_id
     FROM casos_soporte_abiertos c
     JOIN usuarios u ON u.id = c.cliente_id
     LEFT JOIN tickets_soporte t ON t.id = c.ticket_id
     WHERE c.id = $1`,
    [casoId],
  );
}
