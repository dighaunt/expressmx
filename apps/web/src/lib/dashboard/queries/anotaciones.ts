import 'server-only';
import { query } from '@expressmx/database';

export type SeveridadAnotacion = 'info' | 'media' | 'alta' | 'critica';

export interface ClienteAnotacion {
  id: string;
  cliente_id: string;
  severidad: SeveridadAnotacion;
  titulo: string;
  cuerpo_md: string;
  expira_at: string | null;
  creada_por: string;
  creada_por_nombre: string;
  created_at: string;
}

export async function anotacionesActivasPorCliente(
  clienteId: string,
): Promise<ClienteAnotacion[]> {
  return await query<ClienteAnotacion>(
    `SELECT
       a.id, a.cliente_id, a.severidad::text AS severidad,
       a.titulo, a.cuerpo_md, a.expira_at,
       a.creada_por,
       u.nombre || ' ' || u.apellidos AS creada_por_nombre,
       a.created_at
     FROM cliente_anotaciones a
     LEFT JOIN usuarios u ON u.id = a.creada_por
     WHERE a.cliente_id = $1
       AND a.eliminada_at IS NULL
       AND (a.expira_at IS NULL OR a.expira_at > NOW())
     ORDER BY
       CASE a.severidad
         WHEN 'critica' THEN 1
         WHEN 'alta' THEN 2
         WHEN 'media' THEN 3
         WHEN 'info' THEN 4
       END,
       a.created_at DESC`,
    [clienteId],
  );
}

export async function tieneAnotacionAlta(clienteId: string): Promise<boolean> {
  const rows = await query<{ exists: boolean }>(
    `SELECT TRUE AS exists
       FROM cliente_anotaciones
      WHERE cliente_id = $1
        AND eliminada_at IS NULL
        AND (expira_at IS NULL OR expira_at > NOW())
        AND severidad IN ('alta', 'critica')
      LIMIT 1`,
    [clienteId],
  );
  return rows.length > 0;
}
