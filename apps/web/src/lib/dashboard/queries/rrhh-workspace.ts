import 'server-only';
import { query, queryOne } from '@expressmx/database';

export type TipoDocumento = 'ine' | 'domicilio' | 'certificacion' | 'curp';
export type EstatusDocumento = 'pendiente' | 'aprobado' | 'rechazado';

export const TIPO_DOC_LABEL: Record<TipoDocumento, string> = {
  ine: 'INE',
  domicilio: 'Comprobante de domicilio',
  certificacion: 'Certificación',
  curp: 'CURP',
};

export const ESTATUS_DOC_LABEL: Record<EstatusDocumento, string> = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

export interface RRHHQueueCounts {
  docs_pendientes: number;
  invitaciones_activas: number;
  sin_documentar: number;
  aprobaciones_hoy: number;
}

export async function getRRHHQueueCounts(viewerId: string): Promise<RRHHQueueCounts> {
  const row = await queryOne<RRHHQueueCounts>(
    `SELECT
       (SELECT COUNT(*) FROM documentos_prestador
        WHERE estatus = 'pendiente')::INT AS docs_pendientes,
       (SELECT COUNT(*) FROM invitaciones_prestadores
        WHERE usado_en IS NULL AND revocada_en IS NULL AND expira_en > NOW())::INT AS invitaciones_activas,
       (SELECT COUNT(*)
          FROM usuarios u
          WHERE u.rol = 'prestador'
            AND u.activo = TRUE
            AND NOT EXISTS (
              SELECT 1 FROM documentos_prestador dp
              WHERE dp.prestador_id = u.id AND dp.estatus = 'aprobado'
            ))::INT AS sin_documentar,
       (SELECT COUNT(*) FROM logs_auditoria
        WHERE admin_id = $1
          AND accion IN ('prestador.documento_aprobado', 'prestador.documento_rechazado')
          AND DATE(created_at) = CURRENT_DATE)::INT AS aprobaciones_hoy`,
    [viewerId],
  );
  return (
    row ?? {
      docs_pendientes: 0,
      invitaciones_activas: 0,
      sin_documentar: 0,
      aprobaciones_hoy: 0,
    }
  );
}

export type RRHHBucket =
  | 'docs_pendientes'
  | 'invitaciones'
  | 'sin_documentar'
  | 'aprobados_recientes';

export interface RRHHQueueItem {
  kind: 'documento' | 'invitacion' | 'prestador';
  id: string;
  primary: string;
  secondary: string;
  meta: string;
  badge?: string;
  ts: string;
}

interface DocPendienteRow {
  id: string;
  prestador_id: string;
  prestador_nombre: string;
  tipo: TipoDocumento;
  estatus: EstatusDocumento;
  created_at: string;
  fecha_expiracion: string | null;
}

interface InvitacionRow {
  id: string;
  codigo: string;
  creado_por_nombre: string | null;
  expira_en: string;
  notas: string | null;
  created_at: string;
}

interface PrestadorSinDocsRow {
  id: string;
  nombre: string;
  email: string;
  created_at: string;
}

export async function listarColaRRHH(
  viewerId: string,
  bucket: RRHHBucket,
  limit = 30,
): Promise<RRHHQueueItem[]> {
  if (bucket === 'docs_pendientes') {
    const rows = await query<DocPendienteRow>(
      `SELECT
         d.id,
         d.prestador_id,
         u.nombre || ' ' || u.apellidos AS prestador_nombre,
         d.tipo::text AS tipo,
         d.estatus::text AS estatus,
         d.created_at,
         to_char(d.fecha_expiracion, 'YYYY-MM-DD') AS fecha_expiracion
       FROM documentos_prestador d
       JOIN usuarios u ON u.id = d.prestador_id
       WHERE d.estatus = 'pendiente'
       ORDER BY d.created_at ASC
       LIMIT $1`,
      [limit],
    );
    return rows.map((r) => ({
      kind: 'documento',
      id: r.id,
      primary: r.prestador_nombre,
      secondary: TIPO_DOC_LABEL[r.tipo],
      meta: r.fecha_expiracion ? `Expira ${r.fecha_expiracion}` : 'Sin fecha de expiración',
      badge: 'Pendiente',
      ts: r.created_at,
    }));
  }

  if (bucket === 'invitaciones') {
    const rows = await query<InvitacionRow>(
      `SELECT
         i.id,
         i.codigo,
         (SELECT u.nombre || ' ' || u.apellidos
            FROM usuarios u WHERE u.id = i.creado_por) AS creado_por_nombre,
         i.expira_en,
         i.notas,
         i.creado_en AS created_at
       FROM invitaciones_prestadores i
       WHERE i.usado_en IS NULL
         AND i.revocada_en IS NULL
         AND i.expira_en > NOW()
       ORDER BY i.expira_en ASC
       LIMIT $1`,
      [limit],
    );
    return rows.map((r) => ({
      kind: 'invitacion',
      id: r.id,
      primary: `Código ${r.codigo}`,
      secondary: r.creado_por_nombre ?? 'Sin creador',
      meta: r.notas ?? 'Sin notas',
      badge: 'Activa',
      ts: r.created_at,
    }));
  }

  if (bucket === 'sin_documentar') {
    const rows = await query<PrestadorSinDocsRow>(
      `SELECT u.id, u.nombre || ' ' || u.apellidos AS nombre, u.email, u.created_at
       FROM usuarios u
       WHERE u.rol = 'prestador'
         AND u.activo = TRUE
         AND NOT EXISTS (
           SELECT 1 FROM documentos_prestador dp
           WHERE dp.prestador_id = u.id AND dp.estatus = 'aprobado'
         )
       ORDER BY u.created_at DESC
       LIMIT $1`,
      [limit],
    );
    return rows.map((r) => ({
      kind: 'prestador',
      id: r.id,
      primary: r.nombre,
      secondary: r.email,
      meta: 'Sin documentos aprobados',
      ts: r.created_at,
    }));
  }

  const rows = await query<{
    entidad_id: string;
    accion: string;
    valor_nuevo: { prestador_id?: string; estatus?: string } | null;
    created_at: string;
  }>(
    `SELECT entidad_id, accion, valor_nuevo, created_at
     FROM logs_auditoria
     WHERE admin_id = $1
       AND accion IN ('prestador.documento_aprobado', 'prestador.documento_rechazado')
     ORDER BY created_at DESC
     LIMIT $2`,
    [viewerId, limit],
  );
  return rows.map((r) => ({
    kind: 'documento',
    id: r.entidad_id,
    primary: r.accion === 'prestador.documento_aprobado' ? 'Documento aprobado' : 'Documento rechazado',
    secondary: r.entidad_id.slice(0, 8),
    meta: '',
    badge: r.accion === 'prestador.documento_aprobado' ? 'Aprobado' : 'Rechazado',
    ts: r.created_at,
  }));
}

export interface DocumentoDetalle {
  id: string;
  prestador_id: string;
  prestador_nombre: string;
  prestador_email: string;
  prestador_telefono: string | null;
  tipo: TipoDocumento;
  estatus: EstatusDocumento;
  archivo_url: string;
  fecha_expiracion: string | null;
  created_at: string;
  prestador_recibe_ordenes: boolean;
  prestador_restringido: boolean;
  otros_docs_aprobados: number;
}

export async function getDocumentoDetalle(
  documentoId: string,
): Promise<DocumentoDetalle | null> {
  return await queryOne<DocumentoDetalle>(
    `SELECT
       d.id,
       d.prestador_id,
       u.nombre || ' ' || u.apellidos AS prestador_nombre,
       u.email AS prestador_email,
       u.telefono AS prestador_telefono,
       d.tipo::text AS tipo,
       d.estatus::text AS estatus,
       d.archivo_url,
       to_char(d.fecha_expiracion, 'YYYY-MM-DD') AS fecha_expiracion,
       d.created_at,
       u.recibe_ordenes AS prestador_recibe_ordenes,
       (u.restringido_en IS NOT NULL) AS prestador_restringido,
       (SELECT COUNT(*)::INT FROM documentos_prestador
        WHERE prestador_id = d.prestador_id
          AND estatus = 'aprobado'
          AND id <> d.id) AS otros_docs_aprobados
     FROM documentos_prestador d
     JOIN usuarios u ON u.id = d.prestador_id
     WHERE d.id = $1`,
    [documentoId],
  );
}

export interface InvitacionDetalle {
  id: string;
  codigo: string;
  creado_por_nombre: string | null;
  expira_en: string;
  notas: string | null;
  created_at: string;
  estado: 'disponible' | 'usada' | 'revocada' | 'expirada';
}

export async function getInvitacionDetalle(
  invitacionId: string,
): Promise<InvitacionDetalle | null> {
  return await queryOne<InvitacionDetalle>(
    `SELECT
       i.id,
       i.codigo,
       (SELECT u.nombre || ' ' || u.apellidos FROM usuarios u WHERE u.id = i.creado_por) AS creado_por_nombre,
       i.expira_en,
       i.notas,
       i.creado_en AS created_at,
       CASE
         WHEN i.usado_en IS NOT NULL THEN 'usada'
         WHEN i.revocada_en IS NOT NULL THEN 'revocada'
         WHEN i.expira_en < NOW() THEN 'expirada'
         ELSE 'disponible'
       END AS estado
     FROM invitaciones_prestadores i
     WHERE i.id = $1`,
    [invitacionId],
  );
}
