import 'server-only';
import { queryOne } from '@expressmx/database';

export interface VerificacionIdentidadActiva {
  id: string;
  cliente_id: string;
  ticket_id: string | null;
  metodo: string;
  verificado_at: string;
  expira_at: string;
  verificado_por: string;
  verificado_por_nombre: string;
}

export async function getVerificacionActivaByTicket(
  ticketId: string,
): Promise<VerificacionIdentidadActiva | null> {
  return await queryOne<VerificacionIdentidadActiva>(
    `SELECT v.id, v.cliente_id, v.ticket_id, v.metodo,
            v.verificado_at, v.expira_at, v.verificado_por,
            (u.nombre || ' ' || COALESCE(u.apellidos,'')) AS verificado_por_nombre
       FROM verificaciones_identidad_cliente v
       JOIN usuarios u ON u.id = v.verificado_por
      WHERE v.ticket_id = $1 AND v.expira_at > NOW()
      ORDER BY v.verificado_at DESC LIMIT 1`,
    [ticketId],
  );
}

export async function getVerificacionActivaByCliente(
  clienteId: string,
): Promise<VerificacionIdentidadActiva | null> {
  return await queryOne<VerificacionIdentidadActiva>(
    `SELECT v.id, v.cliente_id, v.ticket_id, v.metodo,
            v.verificado_at, v.expira_at, v.verificado_por,
            (u.nombre || ' ' || COALESCE(u.apellidos,'')) AS verificado_por_nombre
       FROM verificaciones_identidad_cliente v
       JOIN usuarios u ON u.id = v.verificado_por
      WHERE v.cliente_id = $1 AND v.expira_at > NOW()
      ORDER BY v.verificado_at DESC LIMIT 1`,
    [clienteId],
  );
}
