import 'server-only';
import { headers } from 'next/headers';
import { query, type Tx } from '@expressmx/database';

export interface AuditEntry {
  adminId: string;
  accion: string;
  entidad: string;
  entidadId?: string | null;
  valorAnterior?: unknown;
  valorNuevo?: unknown;
  casoId?: string | null;
  ticketId?: string | null;
}

async function readRequestMeta(): Promise<{ ip: string | null; ua: string | null }> {
  try {
    const h = await headers();
    const fwd = h.get('x-forwarded-for');
    const ip = fwd ? fwd.split(',')[0]?.trim() ?? null : h.get('x-real-ip');
    const ua = h.get('user-agent');
    return { ip: ip ?? null, ua: ua ?? null };
  } catch {
    return { ip: null, ua: null };
  }
}

const INSERT_SQL = `INSERT INTO logs_auditoria
   (admin_id, accion, entidad, entidad_id, valor_anterior, valor_nuevo,
    ip_address, user_agent, caso_id, ticket_id)
 VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::inet, $8, $9, $10)`;

function buildParams(e: AuditEntry, ip: string | null, ua: string | null): unknown[] {
  return [
    e.adminId,
    e.accion,
    e.entidad,
    e.entidadId ?? null,
    e.valorAnterior !== undefined ? JSON.stringify(e.valorAnterior) : null,
    e.valorNuevo !== undefined ? JSON.stringify(e.valorNuevo) : null,
    ip,
    ua,
    e.casoId ?? null,
    e.ticketId ?? null,
  ];
}

export async function logAccion(tx: Tx, e: AuditEntry): Promise<void> {
  const { ip, ua } = await readRequestMeta();
  await tx.query(INSERT_SQL, buildParams(e, ip, ua));
}

export async function logAccionDirecta(e: AuditEntry): Promise<void> {
  const { ip, ua } = await readRequestMeta();
  await query(INSERT_SQL, buildParams(e, ip, ua));
}
