import 'server-only';
import { query, queryOne } from '@expressmx/database';

export interface MiActividadEntry {
  id: string;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  caso_id: string | null;
  ticket_id: string | null;
  ip_address: string | null;
  created_at: string;
}

export async function getMiActividad(
  userId: string,
  limit = 30,
): Promise<MiActividadEntry[]> {
  return await query<MiActividadEntry>(
    `SELECT
       id, accion, entidad, entidad_id, caso_id, ticket_id,
       ip_address::text AS ip_address, created_at
     FROM logs_auditoria
     WHERE admin_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
}

export interface MiResumen {
  acciones_hoy: number;
  acciones_7d: number;
  casos_atendidos_30d: number;
  tickets_resueltos_30d: number;
}

export async function getMiResumen(userId: string): Promise<MiResumen> {
  const row = await queryOne<MiResumen>(
    `SELECT
       (SELECT COUNT(*) FROM logs_auditoria
        WHERE admin_id = $1 AND DATE(created_at) = CURRENT_DATE)::INT AS acciones_hoy,
       (SELECT COUNT(*) FROM logs_auditoria
        WHERE admin_id = $1 AND created_at >= NOW() - INTERVAL '7 days')::INT AS acciones_7d,
       (SELECT COUNT(*) FROM casos_soporte_abiertos
        WHERE agente_id = $1 AND abierto_en >= NOW() - INTERVAL '30 days')::INT AS casos_atendidos_30d,
       (SELECT COUNT(*) FROM tickets_soporte
        WHERE agente_id = $1
          AND estatus = 'resuelto'
          AND updated_at >= NOW() - INTERVAL '30 days')::INT AS tickets_resueltos_30d`,
    [userId],
  );
  return (
    row ?? {
      acciones_hoy: 0,
      acciones_7d: 0,
      casos_atendidos_30d: 0,
      tickets_resueltos_30d: 0,
    }
  );
}

export interface MiPermisoSummary {
  rol_admin: string | null;
  rol_descripcion: string | null;
  permisos: string[];
}

export async function getMisPermisos(userId: string): Promise<MiPermisoSummary> {
  const rolRow = await queryOne<{ nombre: string | null; descripcion: string | null }>(
    `SELECT r.nombre, r.descripcion
     FROM usuarios_admin ua
     JOIN roles_admin r ON r.id = ua.rol_id
     WHERE ua.usuario_id = $1 AND ua.activo = TRUE`,
    [userId],
  );
  const permisos = await query<{ clave: string }>(
    `SELECT p.clave
     FROM usuarios_admin ua
     JOIN roles_permisos rp ON rp.rol_id = ua.rol_id
     JOIN permisos p ON p.id = rp.permiso_id
     WHERE ua.usuario_id = $1 AND ua.activo = TRUE
     ORDER BY p.clave`,
    [userId],
  );
  return {
    rol_admin: rolRow?.nombre ?? null,
    rol_descripcion: rolRow?.descripcion ?? null,
    permisos: permisos.map((p) => p.clave),
  };
}
