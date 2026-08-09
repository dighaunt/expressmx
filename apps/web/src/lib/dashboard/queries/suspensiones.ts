import 'server-only';
import { queryOne } from '@expressmx/database';

export type MotivoSuspension =
  | 'fraude_sospechoso'
  | 'incumplimiento_pago'
  | 'abuso_servicio'
  | 'queja_prestador'
  | 'verificacion_pendiente'
  | 'a_solicitud_cliente';

export interface SuspensionActiva {
  id: string;
  motivo: MotivoSuspension;
  notas_md: string;
  ventana_inicio: string;
  ventana_fin: string | null;
  creada_por: string;
  creada_por_nombre: string;
  created_at: string;
}

export async function getSuspensionActiva(
  usuarioId: string,
): Promise<SuspensionActiva | null> {
  return await queryOne<SuspensionActiva>(
    `SELECT
       s.id, s.motivo::text AS motivo,
       s.notas_md, s.ventana_inicio, s.ventana_fin,
       s.creada_por,
       u.nombre || ' ' || u.apellidos AS creada_por_nombre,
       s.created_at
     FROM suspensiones_cuenta s
     LEFT JOIN usuarios u ON u.id = s.creada_por
     WHERE s.usuario_id = $1
       AND s.reactivada_at IS NULL
     ORDER BY s.created_at DESC
     LIMIT 1`,
    [usuarioId],
  );
}
