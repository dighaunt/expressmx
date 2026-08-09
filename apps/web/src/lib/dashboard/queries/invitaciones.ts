import 'server-only';
import { query, queryOne } from '@expressmx/database';

export type EstadoInvitacion = 'disponible' | 'usada' | 'revocada' | 'expirada';

export interface InvitacionRow {
  id: string;
  codigo: string;
  estado: EstadoInvitacion;
  notas: string | null;
  creado_en: string;
  expira_en: string;
  usado_en: string | null;
  usado_por_nombre: string | null;
  revocada_en: string | null;
  creado_por_nombre: string | null;
}

export interface InvitacionesFilter {
  estado?: EstadoInvitacion | 'todas';
  q?: string;
  limit?: number;
  offset?: number;
}

const ESTADO_SQL = `
  CASE
    WHEN i.revocada_en IS NOT NULL THEN 'revocada'
    WHEN i.usado_en IS NOT NULL THEN 'usada'
    WHEN i.expira_en < NOW() THEN 'expirada'
    ELSE 'disponible'
  END
`;

export async function listarInvitaciones(filter: InvitacionesFilter = {}): Promise<{
  total: number;
  rows: InvitacionRow[];
}> {
  const where: string[] = [];
  const args: unknown[] = [];

  if (filter.estado && filter.estado !== 'todas') {
    args.push(filter.estado);
    where.push(`(${ESTADO_SQL}) = $${args.length}`);
  }
  if (filter.q && filter.q.trim()) {
    args.push(`%${filter.q.trim().toUpperCase()}%`);
    where.push(`UPPER(i.codigo) LIKE $${args.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);

  const totalRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*) AS total FROM invitaciones_prestadores i ${whereSql}`,
    args,
  );

  args.push(limit, offset);
  const rows = await query<InvitacionRow>(
    `SELECT
       i.id,
       i.codigo,
       (${ESTADO_SQL})::TEXT AS estado,
       i.notas,
       i.creado_en,
       i.expira_en,
       i.usado_en,
       i.revocada_en,
       (cu.nombre || ' ' || COALESCE(LEFT(cu.apellidos, 1) || '.', '')) AS creado_por_nombre,
       (uu.nombre || ' ' || COALESCE(LEFT(uu.apellidos, 1) || '.', '')) AS usado_por_nombre
     FROM invitaciones_prestadores i
     LEFT JOIN usuarios cu ON cu.id = i.creado_por
     LEFT JOIN usuarios uu ON uu.id = i.usado_por
     ${whereSql}
     ORDER BY i.creado_en DESC
     LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );

  return { total: Number(totalRow?.total ?? 0), rows };
}
