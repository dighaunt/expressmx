import 'server-only';
import { query, queryOne } from '@expressmx/database';
import type {
  MajorIncidentDetalle,
  MajorIncidentSummary,
  MajorIncidentTicketLink,
  MajorIncidentUpdate,
} from '@/lib/dashboard/mim-shared';

interface SummaryRow {
  id: string;
  titulo: string;
  estado: string;
  declarado_at: string;
  mitigado_at: string | null;
  resuelto_at: string | null;
  servicios_afectados: string[];
  tickets_vinculados: string | number;
}

function toSummary(row: SummaryRow): MajorIncidentSummary {
  return {
    id: row.id,
    titulo: row.titulo,
    estado: row.estado as MajorIncidentSummary['estado'],
    declarado_at: row.declarado_at,
    mitigado_at: row.mitigado_at,
    resuelto_at: row.resuelto_at,
    servicios_afectados: row.servicios_afectados ?? [],
    tickets_vinculados: Number(row.tickets_vinculados ?? 0),
  };
}

export async function listarMimActivos(): Promise<MajorIncidentSummary[]> {
  const rows = await query<SummaryRow>(
    `SELECT
       m.id,
       m.titulo,
       m.estado::text AS estado,
       m.declarado_at,
       m.mitigado_at,
       m.resuelto_at,
       m.servicios_afectados,
       (SELECT COUNT(*)::INT FROM ticket_major_incident_link
         WHERE major_incident_id = m.id) AS tickets_vinculados
     FROM major_incidents m
     WHERE m.estado IN ('declarado', 'mitigando', 'pir_pendiente')
     ORDER BY m.declarado_at DESC`,
  );
  return rows.map(toSummary);
}

export async function listarMimRecientes(
  limit = 30,
): Promise<MajorIncidentSummary[]> {
  const rows = await query<SummaryRow>(
    `SELECT
       m.id,
       m.titulo,
       m.estado::text AS estado,
       m.declarado_at,
       m.mitigado_at,
       m.resuelto_at,
       m.servicios_afectados,
       (SELECT COUNT(*)::INT FROM ticket_major_incident_link
         WHERE major_incident_id = m.id) AS tickets_vinculados
     FROM major_incidents m
     ORDER BY m.declarado_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map(toSummary);
}

export async function contarMimActivos(): Promise<number> {
  const row = await queryOne<{ total: string | number }>(
    `SELECT COUNT(*)::INT AS total
       FROM major_incidents
      WHERE estado IN ('declarado', 'mitigando', 'pir_pendiente')`,
  );
  return Number(row?.total ?? 0);
}

interface DetalleRow {
  id: string;
  titulo: string;
  descripcion: string;
  estado: string;
  declarado_por: string;
  declarado_por_nombre: string;
  declarado_at: string;
  mitigado_at: string | null;
  resuelto_at: string | null;
  pir_url: string | null;
  servicios_afectados: string[];
  zonas_afectadas: string[];
  tickets_vinculados: string | number;
  created_at: string;
  updated_at: string;
}

export async function getMimDetalle(
  id: string,
): Promise<MajorIncidentDetalle | null> {
  const row = await queryOne<DetalleRow>(
    `SELECT
       m.id,
       m.titulo,
       m.descripcion,
       m.estado::text AS estado,
       m.declarado_por,
       u.nombre || ' ' || u.apellidos AS declarado_por_nombre,
       m.declarado_at,
       m.mitigado_at,
       m.resuelto_at,
       m.pir_url,
       m.servicios_afectados,
       m.zonas_afectadas,
       m.created_at,
       m.updated_at,
       (SELECT COUNT(*)::INT FROM ticket_major_incident_link
         WHERE major_incident_id = m.id) AS tickets_vinculados
     FROM major_incidents m
     JOIN usuarios u ON u.id = m.declarado_por
     WHERE m.id = $1`,
    [id],
  );
  if (!row) return null;
  return {
    id: row.id,
    titulo: row.titulo,
    descripcion: row.descripcion,
    estado: row.estado as MajorIncidentDetalle['estado'],
    declarado_por: row.declarado_por,
    declarado_por_nombre: row.declarado_por_nombre,
    declarado_at: row.declarado_at,
    mitigado_at: row.mitigado_at,
    resuelto_at: row.resuelto_at,
    pir_url: row.pir_url,
    servicios_afectados: row.servicios_afectados ?? [],
    zonas_afectadas: row.zonas_afectadas ?? [],
    tickets_vinculados: Number(row.tickets_vinculados ?? 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listarUpdatesMim(
  mimId: string,
): Promise<MajorIncidentUpdate[]> {
  return await query<MajorIncidentUpdate>(
    `SELECT
       u.id,
       u.contenido_md,
       u.estado_en_momento::text AS estado_en_momento,
       us.nombre || ' ' || us.apellidos AS publicado_por_nombre,
       u.publicado_at
     FROM major_incident_updates u
     JOIN usuarios us ON us.id = u.publicado_por
     WHERE u.major_incident_id = $1
     ORDER BY u.publicado_at DESC`,
    [mimId],
  );
}

export async function listarTicketsVinculadosMim(
  mimId: string,
): Promise<MajorIncidentTicketLink[]> {
  return await query<MajorIncidentTicketLink>(
    `SELECT
       l.ticket_id,
       t.asunto,
       t.estatus::text AS estatus,
       l.vinculado_at,
       u.nombre || ' ' || u.apellidos AS vinculado_por_nombre
     FROM ticket_major_incident_link l
     JOIN tickets_soporte t ON t.id = l.ticket_id
     JOIN usuarios u ON u.id = l.vinculado_por
     WHERE l.major_incident_id = $1
     ORDER BY l.vinculado_at DESC`,
    [mimId],
  );
}

export async function ticketEstaVinculadoAMim(
  ticketId: string,
): Promise<MajorIncidentSummary | null> {
  const row = await queryOne<SummaryRow>(
    `SELECT
       m.id,
       m.titulo,
       m.estado::text AS estado,
       m.declarado_at,
       m.mitigado_at,
       m.resuelto_at,
       m.servicios_afectados,
       (SELECT COUNT(*)::INT FROM ticket_major_incident_link
         WHERE major_incident_id = m.id) AS tickets_vinculados
     FROM major_incidents m
     JOIN ticket_major_incident_link l ON l.major_incident_id = m.id
     WHERE l.ticket_id = $1
     LIMIT 1`,
    [ticketId],
  );
  return row ? toSummary(row) : null;
}
