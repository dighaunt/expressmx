import 'server-only';
import { query, queryOne } from '@expressmx/database';
import type {
  CodigoResolucion,
  EscalationMotivo,
  EstatusTicket,
  PrioridadTicket,
  TierSoporte,
  TipoAutorMsg,
  TipoTicket,
} from '@/lib/dashboard/tickets-shared';

export interface SoporteQueueCounts {
  equipo_activo: number;
  mis_tickets: number;
  sin_asignar: number;
  acciones_pendientes: number;
  casos_activos: number;
  resueltos_recientes: number;
  resueltos_hoy: number;
}

export type SoporteBucket =
  | 'equipo'
  | 'mis'
  | 'sin_asignar'
  | 'acciones'
  | 'resueltos';

export async function getSoporteQueueCounts(agenteId: string): Promise<SoporteQueueCounts> {
  const row = await queryOne<SoporteQueueCounts>(
    `SELECT
       (SELECT COUNT(*) FROM tickets_soporte
        WHERE estatus IN ('abierto', 'en_revision', 'escalado'))::INT AS equipo_activo,
       (SELECT COUNT(*) FROM tickets_soporte
        WHERE agente_id = $1 AND estatus IN ('abierto', 'en_revision', 'escalado'))::INT AS mis_tickets,
       (SELECT COUNT(*) FROM tickets_soporte
        WHERE agente_id IS NULL AND estatus = 'abierto')::INT AS sin_asignar,
       (SELECT COUNT(*)
          FROM tickets_soporte t
         WHERE t.estatus IN ('abierto', 'en_revision', 'escalado')
           AND (
             COALESCE(t.action_status::text, 'ninguno') <> 'ninguno'
             OR EXISTS (
               SELECT 1
                 FROM tareas_caso tc
                WHERE tc.ticket_id = t.id
                  AND tc.grupo_asignado IN ('soporte_l1', 'soporte_l2', 'soporte_l3')
                  AND tc.estado IN ('abierta', 'en_progreso')
             )
           ))::INT AS acciones_pendientes,
       (SELECT COUNT(*) FROM casos_soporte_abiertos
        WHERE agente_id = $1 AND cerrado_en IS NULL AND expira_en > NOW())::INT AS casos_activos,
       (SELECT COUNT(*) FROM tickets_soporte
        WHERE estatus = 'resuelto'
          AND COALESCE(cerrado_at, updated_at) >= NOW() - INTERVAL '14 days')::INT AS resueltos_recientes,
       (SELECT COUNT(*) FROM tickets_soporte
        WHERE agente_id = $1 AND estatus = 'resuelto' AND DATE(updated_at) = CURRENT_DATE)::INT AS resueltos_hoy`,
    [agenteId],
  );
  return (
    row ?? {
      equipo_activo: 0,
      mis_tickets: 0,
      sin_asignar: 0,
      acciones_pendientes: 0,
      casos_activos: 0,
      resueltos_recientes: 0,
      resueltos_hoy: 0,
    }
  );
}

export interface QueueTicket {
  id: string;
  asunto: string;
  estatus: EstatusTicket;
  prioridad: PrioridadTicket;
  tipo: TipoTicket;
  tier_actual: TierSoporte;
  grupo_asignado: string | null;
  cliente_nombre: string;
  agente_id: string | null;
  action_status: string | null;
  action_status_motivo: string | null;
  tareas_abiertas: number;
  created_at: string;
  updated_at: string;
}

export async function listarColaTickets(
  agenteId: string,
  bucket: SoporteBucket,
  limit = 30,
  tipo?: TipoTicket,
): Promise<QueueTicket[]> {
  let where: string;
  const args: unknown[] = [];

  if (bucket === 'equipo') {
    where = `t.estatus IN ('abierto', 'en_revision', 'escalado')`;
  } else if (bucket === 'mis') {
    args.push(agenteId);
    where = `t.agente_id = $1 AND t.estatus IN ('abierto', 'en_revision', 'escalado')`;
  } else if (bucket === 'sin_asignar') {
    where = `t.agente_id IS NULL AND t.estatus = 'abierto'`;
  } else if (bucket === 'acciones') {
    where = `t.estatus IN ('abierto', 'en_revision', 'escalado')
      AND (
        COALESCE(t.action_status::text, 'ninguno') <> 'ninguno'
        OR EXISTS (
          SELECT 1
            FROM tareas_caso tc
           WHERE tc.ticket_id = t.id
             AND tc.grupo_asignado IN ('soporte_l1', 'soporte_l2', 'soporte_l3')
             AND tc.estado IN ('abierta', 'en_progreso')
        )
      )`;
  } else {
    where = `t.estatus = 'resuelto'
      AND COALESCE(t.cerrado_at, t.updated_at) >= NOW() - INTERVAL '14 days'`;
  }

  if (tipo) {
    args.push(tipo);
    where += ` AND t.tipo = $${args.length}::tipo_ticket`;
  }

  args.push(limit);
  return await query<QueueTicket>(
    `SELECT
       t.id,
       t.asunto,
       t.estatus::text AS estatus,
       t.prioridad::text AS prioridad,
       t.tipo::text AS tipo,
       t.tier_actual::text AS tier_actual,
       t.grupo_asignado,
       u.nombre || ' ' || u.apellidos AS cliente_nombre,
       t.agente_id,
       t.action_status::text AS action_status,
       t.action_status_motivo,
       COALESCE(tc.tareas_abiertas, 0)::INT AS tareas_abiertas,
       t.created_at,
       t.updated_at
     FROM tickets_soporte t
     JOIN usuarios u ON u.id = t.usuario_id
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::INT AS tareas_abiertas
         FROM tareas_caso tca
        WHERE tca.ticket_id = t.id
          AND tca.estado IN ('abierta', 'en_progreso')
     ) tc ON TRUE
     WHERE ${where}
     ORDER BY
       CASE t.prioridad
         WHEN 'critica' THEN 0
         WHEN 'alta' THEN 1
         WHEN 'media' THEN 2
         ELSE 3
       END,
       COALESCE(t.cerrado_at, t.updated_at) DESC
     LIMIT $${args.length}`,
    args,
  );
}

export interface TicketDetalle {
  id: string;
  asunto: string;
  estatus: EstatusTicket;
  prioridad: PrioridadTicket;
  categoria: string;
  tipo: TipoTicket;
  tier_actual: TierSoporte;
  grupo_asignado: string | null;
  problem_id: string | null;
  es_major_incident: boolean;
  agente_id: string | null;
  agente_nombre: string | null;
  cliente_id: string;
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono: string | null;
  orden_id: string | null;
  resolucion_codigo: CodigoResolucion | null;
  resolucion_notas: string | null;
  cerrado_at: string | null;
  cerrado_por_nombre: string | null;
  created_at: string;
  updated_at: string;
}

export async function getTicketDetalle(ticketId: string): Promise<TicketDetalle | null> {
  return await queryOne<TicketDetalle>(
    `SELECT
       t.id,
       t.asunto,
       t.estatus::text AS estatus,
       t.prioridad::text AS prioridad,
       t.categoria::text AS categoria,
       t.tipo::text AS tipo,
       t.tier_actual::text AS tier_actual,
       t.grupo_asignado,
       t.problem_id,
       t.es_major_incident,
       t.agente_id,
       a.nombre || ' ' || a.apellidos AS agente_nombre,
       t.usuario_id AS cliente_id,
       u.nombre || ' ' || u.apellidos AS cliente_nombre,
       u.email AS cliente_email,
       u.telefono AS cliente_telefono,
       t.orden_id,
       t.resolucion_codigo::text AS resolucion_codigo,
       t.resolucion_notas,
       t.cerrado_at,
       cp.nombre || ' ' || cp.apellidos AS cerrado_por_nombre,
       t.created_at,
       t.updated_at
     FROM tickets_soporte t
     JOIN usuarios u ON u.id = t.usuario_id
     LEFT JOIN usuarios a ON a.id = t.agente_id
     LEFT JOIN usuarios cp ON cp.id = t.cerrado_por
     WHERE t.id = $1`,
    [ticketId],
  );
}

export interface EscalationLogEntry {
  id: string;
  ticket_id: string;
  from_tier: TierSoporte;
  to_tier: TierSoporte;
  motivo: EscalationMotivo;
  hipotesis: string;
  kb_consultados: string[];
  from_user: string;
  from_user_nombre: string | null;
  to_grupo: string;
  to_user: string | null;
  to_user_nombre: string | null;
  ocurrido_at: string;
}

export async function getEscalationLog(
  ticketId: string,
): Promise<EscalationLogEntry[]> {
  return await query<EscalationLogEntry>(
    `SELECT
       e.id,
       e.ticket_id,
       e.from_tier::text AS from_tier,
       e.to_tier::text AS to_tier,
       e.motivo::text AS motivo,
       e.hipotesis,
       e.kb_consultados,
       e.from_user,
       fu.nombre || ' ' || fu.apellidos AS from_user_nombre,
       e.to_grupo,
       e.to_user,
       tu.nombre || ' ' || tu.apellidos AS to_user_nombre,
       e.ocurrido_at
     FROM escalation_log_ticket e
     LEFT JOIN usuarios fu ON fu.id = e.from_user
     LEFT JOIN usuarios tu ON tu.id = e.to_user
     WHERE e.ticket_id = $1
     ORDER BY e.ocurrido_at DESC`,
    [ticketId],
  );
}

export interface ActivityItem {
  source: 'mensaje' | 'audit';
  ts: string;
  author: string;
  authorTone: 'agent' | 'cliente' | 'sistema' | 'audit';
  content: string;
  small?: string;
  esInterno?: boolean;
}

interface MensajeRow {
  ts: string;
  author: string;
  tipo_autor: TipoAutorMsg;
  contenido: string;
  es_interno: boolean;
}

interface AuditRow {
  ts: string;
  author: string;
  accion: string;
  entidad: string;
  valor_anterior: unknown;
  valor_nuevo: unknown;
}

export async function getActivityFeed(scope: {
  ticketId?: string;
  casoId?: string;
}): Promise<ActivityItem[]> {
  const items: ActivityItem[] = [];

  if (scope.ticketId) {
    const mensajes = await query<MensajeRow>(
      `SELECT
         m.created_at AS ts,
         COALESCE(u.nombre || ' ' || u.apellidos, 'Sistema') AS author,
         m.tipo_autor::text AS tipo_autor,
         m.contenido,
         m.es_interno
       FROM mensajes_ticket m
       LEFT JOIN usuarios u ON u.id = m.autor_id
       WHERE m.ticket_id = $1
       ORDER BY m.created_at`,
      [scope.ticketId],
    );
    for (const m of mensajes) {
      items.push({
        source: 'mensaje',
        ts: m.ts,
        author: m.author,
        authorTone:
          m.tipo_autor === 'agente'
            ? 'agent'
            : m.tipo_autor === 'usuario'
              ? 'cliente'
              : 'sistema',
        content: m.contenido,
        esInterno: m.es_interno === true,
      });
    }
  }

  const where: string[] = [];
  const args: unknown[] = [];
  if (scope.ticketId) {
    args.push(scope.ticketId);
    where.push(`l.ticket_id = $${args.length}`);
  }
  if (scope.casoId) {
    args.push(scope.casoId);
    where.push(`l.caso_id = $${args.length}`);
  }
  if (where.length > 0) {
    const audits = await query<AuditRow>(
      `SELECT
         l.created_at AS ts,
         COALESCE(u.nombre || ' ' || u.apellidos, 'Sistema') AS author,
         l.accion,
         l.entidad,
         l.valor_anterior,
         l.valor_nuevo
       FROM logs_auditoria l
       LEFT JOIN usuarios u ON u.id = l.admin_id
       WHERE ${where.join(' OR ')}
       ORDER BY l.created_at`,
      args,
    );
    for (const a of audits) {
      items.push({
        source: 'audit',
        ts: a.ts,
        author: a.author,
        authorTone: 'audit',
        content: a.accion,
        small: a.entidad,
      });
    }
  }

  items.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  return items;
}

export interface OrdenResumen {
  id: string;
  estatus: string;
  servicio_nombre: string;
  monto_total: string;
  fecha_programada: string;
  created_at: string;
}

export async function getOrdenesRecientesDeCliente(
  clienteId: string,
  limit = 5,
): Promise<OrdenResumen[]> {
  return await query<OrdenResumen>(
    `SELECT
       o.id,
       o.estatus::text AS estatus,
       s.nombre AS servicio_nombre,
       o.monto_total::text AS monto_total,
       o.fecha_programada,
       o.created_at
     FROM ordenes_servicio o
     JOIN servicios s ON s.id = o.servicio_id
     WHERE o.cliente_id = $1
     ORDER BY o.created_at DESC
     LIMIT $2`,
    [clienteId, limit],
  );
}

export type ChurnRisk = 'bajo' | 'medio' | 'alto';

export interface CustomerHealth {
  cliente_id: string;
  total_tickets: number;
  tickets_abiertos: number;
  tickets_cerrados_30d: number;
  csat_promedio_90d: number | null;
  ultimo_contacto: string | null;
  total_ordenes: number;
  total_gastado_mxn: number;
  churn_risk: ChurnRisk;
}

interface CustomerHealthRow {
  total_tickets: number;
  tickets_abiertos: number;
  tickets_cerrados_30d: number;
  csat_promedio_90d: string | null;
  ultimo_contacto: string | null;
  total_ordenes: number;
  total_gastado_mxn: string | null;
}

function computeChurnRisk(input: {
  ticketsAbiertos: number;
  ticketsCerrados30d: number;
  csatPromedio90d: number | null;
}): ChurnRisk {
  const { ticketsAbiertos, ticketsCerrados30d, csatPromedio90d } = input;
  if (
    ticketsAbiertos >= 3 ||
    (csatPromedio90d !== null && csatPromedio90d < 3)
  ) {
    return 'alto';
  }
  if (
    ticketsCerrados30d >= 5 ||
    (csatPromedio90d !== null && csatPromedio90d < 4)
  ) {
    return 'medio';
  }
  return 'bajo';
}

export async function getCustomerHealth(
  clienteId: string,
): Promise<CustomerHealth> {
  const row = await queryOne<CustomerHealthRow>(
    `WITH tk AS (
       SELECT
         COUNT(*)::INT AS total_tickets,
         COUNT(*) FILTER (
           WHERE estatus::text NOT IN ('resuelto', 'cerrado', 'cancelado')
         )::INT AS tickets_abiertos,
         COUNT(*) FILTER (
           WHERE cerrado_at IS NOT NULL AND cerrado_at > NOW() - INTERVAL '30 days'
         )::INT AS tickets_cerrados_30d,
         MAX(updated_at)::TIMESTAMPTZ AS ultimo_contacto
       FROM tickets_soporte
       WHERE usuario_id = $1
     ),
     cs AS (
       SELECT AVG(csat_score)::TEXT AS csat_promedio_90d
         FROM csat_surveys
        WHERE cliente_id = $1
          AND respondido_at IS NOT NULL
          AND respondido_at > NOW() - INTERVAL '90 days'
     ),
     ord AS (
       SELECT
         COUNT(*)::INT AS total_ordenes,
         COALESCE(SUM(monto_total), 0)::TEXT AS total_gastado_mxn
       FROM ordenes_servicio
       WHERE cliente_id = $1
     )
     SELECT
       tk.total_tickets,
       tk.tickets_abiertos,
       tk.tickets_cerrados_30d,
       tk.ultimo_contacto,
       cs.csat_promedio_90d,
       ord.total_ordenes,
       ord.total_gastado_mxn
     FROM tk, cs, ord`,
    [clienteId],
  );

  const totalTickets = row?.total_tickets ?? 0;
  const ticketsAbiertos = row?.tickets_abiertos ?? 0;
  const ticketsCerrados30d = row?.tickets_cerrados_30d ?? 0;
  const csatPromedio90d =
    row?.csat_promedio_90d !== null && row?.csat_promedio_90d !== undefined
      ? Number(row.csat_promedio_90d)
      : null;
  const csatNumero =
    csatPromedio90d !== null && Number.isFinite(csatPromedio90d)
      ? csatPromedio90d
      : null;
  const totalOrdenes = row?.total_ordenes ?? 0;
  const totalGastado =
    row?.total_gastado_mxn !== null && row?.total_gastado_mxn !== undefined
      ? Number(row.total_gastado_mxn)
      : 0;

  return {
    cliente_id: clienteId,
    total_tickets: totalTickets,
    tickets_abiertos: ticketsAbiertos,
    tickets_cerrados_30d: ticketsCerrados30d,
    csat_promedio_90d: csatNumero,
    ultimo_contacto: row?.ultimo_contacto ?? null,
    total_ordenes: totalOrdenes,
    total_gastado_mxn: Number.isFinite(totalGastado) ? totalGastado : 0,
    churn_risk: computeChurnRisk({
      ticketsAbiertos,
      ticketsCerrados30d,
      csatPromedio90d: csatNumero,
    }),
  };
}

export interface TicketHistorialEntry {
  id: string;
  asunto: string;
  estatus: EstatusTicket;
  tipo: TipoTicket;
  cerrado_at: string | null;
  resolucion_codigo: CodigoResolucion | null;
  created_at: string;
  csat_score: number | null;
}

export async function getHistorialTicketsCliente(
  clienteId: string,
  limit = 10,
): Promise<TicketHistorialEntry[]> {
  return await query<TicketHistorialEntry>(
    `SELECT
       t.id,
       t.asunto,
       t.estatus::text AS estatus,
       t.tipo::text AS tipo,
       t.cerrado_at,
       t.resolucion_codigo::text AS resolucion_codigo,
       t.created_at,
       cs.csat_score
       FROM tickets_soporte t
       LEFT JOIN csat_surveys cs
              ON cs.ticket_id = t.id
             AND cs.estado = 'respondido'
      WHERE t.usuario_id = $1
      ORDER BY t.created_at DESC
      LIMIT $2`,
    [clienteId, limit],
  );
}

export interface AgenteRendimiento {
  ventana_dias: number;
  tickets_resueltos: number;
  tickets_escalados: number;
  ttr_promedio_horas: number | null;
  frt_promedio_minutos: number | null;
  fcr_porcentaje: number | null;
  csat_promedio: number | null;
  csat_respuestas: number;
  sla_breach_porcentaje: number | null;
}

interface AgenteMetricasRow {
  tickets_resueltos: string | number;
  tickets_escalados: string | number;
  ttr_promedio_horas: string | null;
  frt_promedio_minutos: string | null;
  fcr_porcentaje: string | null;
  csat_promedio: string | null;
  csat_respuestas: string | number;
  sla_breach_porcentaje: string | null;
}

export async function getRendimientoAgente(
  agenteId: string,
  ventanaDias = 30,
): Promise<AgenteRendimiento> {
  const intervalo = `${ventanaDias} days`;
  const row = await queryOne<AgenteMetricasRow>(
    `WITH cerrados AS (
       SELECT t.id, t.created_at, t.cerrado_at, t.resolucion_codigo::text AS codigo
         FROM tickets_soporte t
        WHERE t.cerrado_por = $1
          AND t.cerrado_at > NOW() - $2::interval
     ),
     escalados AS (
       SELECT DISTINCT e.ticket_id
         FROM escalation_log_ticket e
        WHERE e.from_user = $1
          AND e.ocurrido_at > NOW() - $2::interval
     ),
     frt AS (
       SELECT EXTRACT(EPOCH FROM (s.primer_respuesta_at - t.created_at)) / 60.0 AS minutos
         FROM ticket_sla_state s
         JOIN tickets_soporte t ON t.id = s.ticket_id
        WHERE t.cerrado_por = $1
          AND s.primer_respuesta_at IS NOT NULL
          AND s.primer_respuesta_at > NOW() - $2::interval
     ),
     csat AS (
       SELECT cs.csat_score
         FROM csat_surveys cs
        WHERE cs.agente_id = $1
          AND cs.estado = 'respondido'
          AND cs.respondido_at > NOW() - $2::interval
     ),
     breach AS (
       SELECT
         COUNT(*)::INT AS total,
         COUNT(*) FILTER (WHERE s.breached_ttr)::INT AS rotos
         FROM ticket_sla_state s
         JOIN tickets_soporte t ON t.id = s.ticket_id
        WHERE t.cerrado_por = $1
          AND s.resuelto_at IS NOT NULL
          AND s.resuelto_at > NOW() - $2::interval
     )
     SELECT
       (SELECT COUNT(*)::INT FROM cerrados) AS tickets_resueltos,
       (SELECT COUNT(*)::INT FROM escalados) AS tickets_escalados,
       (SELECT AVG(EXTRACT(EPOCH FROM (cerrado_at - created_at)) / 3600.0)::TEXT
          FROM cerrados) AS ttr_promedio_horas,
       (SELECT AVG(minutos)::TEXT FROM frt) AS frt_promedio_minutos,
       (SELECT
          CASE
            WHEN COUNT(*) = 0 THEN NULL
            ELSE (
              COUNT(*) FILTER (WHERE codigo = 'resuelto_directo')::NUMERIC
              * 100.0 / COUNT(*)
            )::TEXT
          END
          FROM cerrados) AS fcr_porcentaje,
       (SELECT AVG(csat_score)::TEXT FROM csat) AS csat_promedio,
       (SELECT COUNT(*)::INT FROM csat) AS csat_respuestas,
       (SELECT
          CASE
            WHEN total = 0 THEN NULL
            ELSE (rotos::NUMERIC * 100.0 / total)::TEXT
          END
          FROM breach) AS sla_breach_porcentaje`,
    [agenteId, intervalo],
  );

  const parseNum = (v: string | null | undefined): number | null => {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return {
    ventana_dias: ventanaDias,
    tickets_resueltos: Number(row?.tickets_resueltos ?? 0),
    tickets_escalados: Number(row?.tickets_escalados ?? 0),
    ttr_promedio_horas: parseNum(row?.ttr_promedio_horas ?? null),
    frt_promedio_minutos: parseNum(row?.frt_promedio_minutos ?? null),
    fcr_porcentaje: parseNum(row?.fcr_porcentaje ?? null),
    csat_promedio: parseNum(row?.csat_promedio ?? null),
    csat_respuestas: Number(row?.csat_respuestas ?? 0),
    sla_breach_porcentaje: parseNum(row?.sla_breach_porcentaje ?? null),
  };
}

export interface SoporteHomeKpis {
  mim_activos: number;
  tickets_breached: number;
  csat_promedio_30d: number | null;
  resueltos_hoy_equipo: number;
}

export async function getSoporteHomeKpis(): Promise<SoporteHomeKpis> {
  const row = await queryOne<{
    mim_activos: string | number;
    tickets_breached: string | number;
    csat_promedio_30d: string | null;
    resueltos_hoy_equipo: string | number;
  }>(
    `SELECT
       (SELECT COUNT(*)::INT FROM major_incidents
         WHERE estado IN ('declarado', 'mitigando', 'pir_pendiente'))
         AS mim_activos,
       (SELECT COUNT(*)::INT FROM ticket_sla_state s
         JOIN tickets_soporte t ON t.id = s.ticket_id
         WHERE s.breached_ttr = TRUE
           AND s.resuelto_at IS NULL
           AND t.estatus IN ('abierto', 'en_revision', 'escalado'))
         AS tickets_breached,
       (SELECT AVG(csat_score)::TEXT FROM csat_surveys
         WHERE estado = 'respondido'
           AND respondido_at > NOW() - INTERVAL '30 days')
         AS csat_promedio_30d,
       (SELECT COUNT(*)::INT FROM tickets_soporte
         WHERE estatus = 'resuelto'
           AND DATE(updated_at) = CURRENT_DATE)
         AS resueltos_hoy_equipo`,
  );
  const csat =
    row?.csat_promedio_30d !== null && row?.csat_promedio_30d !== undefined
      ? Number(row.csat_promedio_30d)
      : null;
  return {
    mim_activos: Number(row?.mim_activos ?? 0),
    tickets_breached: Number(row?.tickets_breached ?? 0),
    csat_promedio_30d: csat !== null && Number.isFinite(csat) ? csat : null,
    resueltos_hoy_equipo: Number(row?.resueltos_hoy_equipo ?? 0),
  };
}
