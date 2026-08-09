import 'server-only';
import { query, queryOne } from '@expressmx/database';

export interface CsatSummary {
  total_enviados: number;
  total_respondidos: number;
  csat_promedio: number | null;
  ces_promedio: number | null;
  detractores: number;
  promotores: number;
}

interface CsatSummaryRow {
  total_enviados: number;
  total_respondidos: number;
  csat_promedio: string | null;
  ces_promedio: string | null;
  detractores: number;
  promotores: number;
}

function toNumberOrNull(value: string | null): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function getCsatPorAgente(
  agenteId: string,
  dias = 30,
): Promise<CsatSummary> {
  const row = await queryOne<CsatSummaryRow>(
    `SELECT
       COUNT(*) FILTER (WHERE estado IN ('enviado', 'respondido'))::INT AS total_enviados,
       COUNT(*) FILTER (WHERE estado = 'respondido')::INT AS total_respondidos,
       AVG(csat_score) FILTER (WHERE csat_score IS NOT NULL)::TEXT AS csat_promedio,
       AVG(ces_score) FILTER (WHERE ces_score IS NOT NULL)::TEXT AS ces_promedio,
       COUNT(*) FILTER (WHERE csat_score IS NOT NULL AND csat_score <= 2)::INT AS detractores,
       COUNT(*) FILTER (WHERE csat_score IS NOT NULL AND csat_score >= 4)::INT AS promotores
       FROM csat_surveys
      WHERE agente_id = $1
        AND created_at > NOW() - ($2::INT || ' days')::INTERVAL`,
    [agenteId, dias],
  );

  if (!row) {
    return {
      total_enviados: 0,
      total_respondidos: 0,
      csat_promedio: null,
      ces_promedio: null,
      detractores: 0,
      promotores: 0,
    };
  }

  return {
    total_enviados: row.total_enviados ?? 0,
    total_respondidos: row.total_respondidos ?? 0,
    csat_promedio: toNumberOrNull(row.csat_promedio),
    ces_promedio: toNumberOrNull(row.ces_promedio),
    detractores: row.detractores ?? 0,
    promotores: row.promotores ?? 0,
  };
}

export interface CsatPorClienteSummary {
  total_resueltos: number;
  total_csat_respondidos: number;
  csat_promedio: number | null;
  ultimo_csat: { score: number; respondido_at: string } | null;
}

interface CsatPorClienteRow {
  total_resueltos: number;
  total_csat_respondidos: number;
  csat_promedio: string | null;
  ultimo_csat_score: number | null;
  ultimo_csat_respondido_at: string | null;
}

export async function getCsatPorCliente(
  clienteId: string,
): Promise<CsatPorClienteSummary> {
  const row = await queryOne<CsatPorClienteRow>(
    `WITH resueltos AS (
       SELECT COUNT(*)::INT AS total
         FROM tickets_soporte
        WHERE usuario_id = $1
          AND estatus::text IN ('resuelto', 'cerrado')
     ),
     respuestas AS (
       SELECT
         COUNT(*)::INT AS total,
         AVG(csat_score)::TEXT AS promedio
         FROM csat_surveys
        WHERE cliente_id = $1
          AND estado = 'respondido'
     ),
     ultimo AS (
       SELECT csat_score, respondido_at
         FROM csat_surveys
        WHERE cliente_id = $1
          AND estado = 'respondido'
        ORDER BY respondido_at DESC
        LIMIT 1
     )
     SELECT
       resueltos.total AS total_resueltos,
       respuestas.total AS total_csat_respondidos,
       respuestas.promedio AS csat_promedio,
       (SELECT csat_score FROM ultimo) AS ultimo_csat_score,
       (SELECT respondido_at FROM ultimo) AS ultimo_csat_respondido_at
       FROM resueltos, respuestas`,
    [clienteId],
  );

  if (!row) {
    return {
      total_resueltos: 0,
      total_csat_respondidos: 0,
      csat_promedio: null,
      ultimo_csat: null,
    };
  }

  const ultimo =
    row.ultimo_csat_score !== null && row.ultimo_csat_respondido_at !== null
      ? {
          score: row.ultimo_csat_score,
          respondido_at: row.ultimo_csat_respondido_at,
        }
      : null;

  return {
    total_resueltos: row.total_resueltos ?? 0,
    total_csat_respondidos: row.total_csat_respondidos ?? 0,
    csat_promedio: toNumberOrNull(row.csat_promedio),
    ultimo_csat: ultimo,
  };
}

export interface CsatPendiente {
  id: string;
  ticket_id: string;
  ticket_asunto: string;
  expira_at: string;
}

export async function getCsatPendiente(
  clienteId: string,
): Promise<CsatPendiente[]> {
  return await query<CsatPendiente>(
    `SELECT
       s.id,
       s.ticket_id,
       t.asunto AS ticket_asunto,
       s.expira_at
       FROM csat_surveys s
       JOIN tickets_soporte t ON t.id = s.ticket_id
      WHERE s.cliente_id = $1
        AND s.estado IN ('pendiente', 'enviado')
        AND s.expira_at > NOW()
      ORDER BY s.expira_at ASC`,
    [clienteId],
  );
}
