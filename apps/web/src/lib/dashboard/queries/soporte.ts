import 'server-only';
import { query, queryOne } from '@expressmx/database';

export interface CasoActivo {
  id: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono: string | null;
  cliente_avatar_url: string | null;
  abierto_en: string;
  expira_en: string;
}

export async function getCasoActivoDelAgente(agenteId: string): Promise<CasoActivo | null> {
  return await queryOne<CasoActivo>(
    `SELECT
       c.id,
       c.cliente_id,
       u.nombre || ' ' || u.apellidos AS cliente_nombre,
       u.email AS cliente_email,
       u.telefono AS cliente_telefono,
       u.avatar_url AS cliente_avatar_url,
       c.abierto_en,
       c.expira_en
     FROM casos_soporte_abiertos c
     JOIN usuarios u ON u.id = c.cliente_id
     WHERE c.agente_id = $1
       AND c.cerrado_en IS NULL
       AND c.expira_en > NOW()
     ORDER BY c.abierto_en DESC
     LIMIT 1`,
    [agenteId],
  );
}

export async function listarCasosDelAgente(
  agenteId: string,
  limit = 30,
): Promise<Array<{
  id: string;
  cliente_nombre: string;
  abierto_en: string;
  cerrado_en: string | null;
  expira_en: string;
}>> {
  return await query(
    `SELECT
       c.id,
       u.nombre || ' ' || u.apellidos AS cliente_nombre,
       c.abierto_en,
       c.cerrado_en,
       c.expira_en
     FROM casos_soporte_abiertos c
     JOIN usuarios u ON u.id = c.cliente_id
     WHERE c.agente_id = $1
     ORDER BY c.abierto_en DESC
     LIMIT $2`,
    [agenteId, limit],
  );
}

export async function tieneAccesoAlCliente(
  agenteId: string,
  clienteId: string,
): Promise<boolean> {
  const r = await queryOne<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM casos_soporte_abiertos
       WHERE agente_id = $1
         AND cliente_id = $2
         AND cerrado_en IS NULL
         AND expira_en > NOW()
     ) AS ok`,
    [agenteId, clienteId],
  );
  return Boolean(r?.ok);
}
