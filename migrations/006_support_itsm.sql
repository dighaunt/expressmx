

BEGIN;

DO $$ BEGIN
  CREATE TYPE tipo_ticket AS ENUM ('incidente', 'solicitud', 'problema', 'cambio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tier_soporte AS ENUM ('l1', 'l2', 'l3');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estatus_ticket_v2 AS ENUM (
    'nuevo',
    'en_progreso',
    'en_espera_cliente',
    'en_espera_tercero',
    'resuelto',
    'cerrado',
    'cancelado',
    'investigacion',
    'error_conocido',
    'fix_en_progreso'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE codigo_resolucion AS ENUM (
    'resuelto_directo',
    'kb_resuelto',
    'reembolso_emitido',
    'duplicado',
    'no_aplica',
    'no_reproducible',
    'sin_respuesta_cliente'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE escalation_motivo AS ENUM (
    'fuera_alcance',
    'requiere_autorizacion',
    'requiere_dev',
    'sla_breach',
    'cliente_solicitud'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estado_csat AS ENUM ('pendiente', 'enviado', 'respondido', 'expirado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estado_mim AS ENUM ('declarado', 'mitigando', 'resuelto', 'pir_pendiente', 'cerrado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE audiencia_kb AS ENUM ('cliente', 'agente_l1', 'agente_l2_l3', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE tickets_soporte
  ADD COLUMN IF NOT EXISTS tipo tipo_ticket NOT NULL DEFAULT 'incidente',
  ADD COLUMN IF NOT EXISTS tier_actual tier_soporte NOT NULL DEFAULT 'l1',
  ADD COLUMN IF NOT EXISTS grupo_asignado TEXT,
  ADD COLUMN IF NOT EXISTS resolucion_codigo codigo_resolucion,
  ADD COLUMN IF NOT EXISTS resolucion_notas TEXT,
  ADD COLUMN IF NOT EXISTS cerrado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cerrado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS problem_id UUID REFERENCES tickets_soporte(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS workaround_md TEXT,
  ADD COLUMN IF NOT EXISTS causa_raiz_md TEXT,
  ADD COLUMN IF NOT EXISTS fix_permanente_md TEXT,
  ADD COLUMN IF NOT EXISTS es_major_incident BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE tickets_soporte
   SET grupo_asignado = CASE
     WHEN categoria::text = 'cobro_incorrecto' THEN 'finanzas_l2'
     WHEN categoria::text IN ('dano_propiedad', 'queja_servicio') THEN 'soporte_l1'
     WHEN categoria::text = 'no_show' THEN 'operaciones_l1'
     ELSE 'soporte_l1'
   END
 WHERE grupo_asignado IS NULL;

ALTER TABLE tickets_soporte
  ALTER COLUMN grupo_asignado SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE tickets_soporte
    ADD CONSTRAINT chk_problem_fields_only_for_problem
    CHECK (
      (tipo = 'problema')
      OR (workaround_md IS NULL AND causa_raiz_md IS NULL AND fix_permanente_md IS NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE tickets_soporte
    ADD CONSTRAINT chk_resolucion_required_when_closed
    CHECK (
      estatus::text NOT IN ('cerrado', 'resuelto')
      OR (resolucion_codigo IS NOT NULL AND resolucion_notas IS NOT NULL AND length(resolucion_notas) >= 10)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE tickets_soporte
    ADD CONSTRAINT chk_problem_no_self
    CHECK (problem_id IS NULL OR problem_id <> id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_tickets_tipo_estatus
  ON tickets_soporte (tipo, estatus);

CREATE INDEX IF NOT EXISTS idx_tickets_tier_grupo
  ON tickets_soporte (tier_actual, grupo_asignado);

CREATE INDEX IF NOT EXISTS idx_tickets_problem
  ON tickets_soporte (problem_id) WHERE problem_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_major_incident
  ON tickets_soporte (es_major_incident) WHERE es_major_incident = TRUE;

CREATE INDEX IF NOT EXISTS idx_tickets_grupo_estatus
  ON tickets_soporte (grupo_asignado, estatus);

ALTER TABLE mensajes_ticket
  ADD COLUMN IF NOT EXISTS es_interno BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS canned_response_id UUID;

CREATE INDEX IF NOT EXISTS idx_mensajes_ticket_visible
  ON mensajes_ticket (ticket_id, es_interno, created_at);

CREATE TABLE IF NOT EXISTS escalation_log_ticket (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets_soporte(id) ON DELETE CASCADE,
  from_tier tier_soporte NOT NULL,
  to_tier tier_soporte NOT NULL,
  motivo escalation_motivo NOT NULL,
  hipotesis TEXT NOT NULL CHECK (length(hipotesis) >= 20),
  kb_consultados UUID[] NOT NULL DEFAULT '{}',
  from_user UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  to_grupo TEXT NOT NULL,
  to_user UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ocurrido_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalation_ticket
  ON escalation_log_ticket (ticket_id, ocurrido_at DESC);

ALTER TABLE escalation_log_ticket ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS sla_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'America/Mexico_City',

  

  

  
  config_jsonb JSONB NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  tipo tipo_ticket NOT NULL,
  prioridad prioridad_ticket NOT NULL,
  categoria cat_ticket,
  frt_minutos INTEGER NOT NULL CHECK (frt_minutos > 0),
  ttr_minutos INTEGER NOT NULL CHECK (ttr_minutos > 0),
  business_hours_only BOOLEAN NOT NULL DEFAULT TRUE,
  calendar_id UUID REFERENCES sla_calendars(id) ON DELETE RESTRICT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_policies_match
  ON sla_policies (tipo, prioridad, categoria, activo)
  WHERE activo = TRUE;

CREATE TABLE IF NOT EXISTS ticket_sla_state (
  ticket_id UUID PRIMARY KEY REFERENCES tickets_soporte(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES sla_policies(id) ON DELETE RESTRICT,
  frt_due_at TIMESTAMPTZ NOT NULL,
  ttr_due_at TIMESTAMPTZ NOT NULL,
  primer_respuesta_at TIMESTAMPTZ,
  resuelto_at TIMESTAMPTZ,
  paused_since TIMESTAMPTZ,
  paused_total_secs INTEGER NOT NULL DEFAULT 0 CHECK (paused_total_secs >= 0),
  notified_50  BOOLEAN NOT NULL DEFAULT FALSE,
  notified_80  BOOLEAN NOT NULL DEFAULT FALSE,
  notified_100 BOOLEAN NOT NULL DEFAULT FALSE,
  breached_frt BOOLEAN GENERATED ALWAYS AS (
    primer_respuesta_at IS NOT NULL AND primer_respuesta_at > frt_due_at
  ) STORED,
  breached_ttr BOOLEAN GENERATED ALWAYS AS (
    resuelto_at IS NOT NULL AND resuelto_at > ttr_due_at
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_state_frt_pending
  ON ticket_sla_state (frt_due_at) WHERE primer_respuesta_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sla_state_ttr_pending
  ON ticket_sla_state (ttr_due_at) WHERE resuelto_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sla_state_notify_pending
  ON ticket_sla_state (ttr_due_at)
  WHERE resuelto_at IS NULL AND notified_100 = FALSE;

ALTER TABLE sla_calendars   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_policies    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_sla_state ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  contenido_md TEXT NOT NULL,
  resumen TEXT,
  categoria cat_ticket,
  tipo_aplica tipo_ticket[] NOT NULL DEFAULT '{}',
  audiencia audiencia_kb[] NOT NULL DEFAULT '{cliente,agente_l1,agente_l2_l3}',
  tier_minimo tier_soporte NOT NULL DEFAULT 'l1',
  publicado BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  helpful_count INTEGER NOT NULL DEFAULT 0 CHECK (helpful_count >= 0),
  not_helpful_count INTEGER NOT NULL DEFAULT 0 CHECK (not_helpful_count >= 0),
  autor_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  publicado_en TIMESTAMPTZ,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce(titulo, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(resumen, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(contenido_md, '')), 'C')
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_search       ON kb_articles USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_kb_published    ON kb_articles (publicado, categoria) WHERE publicado;
CREATE INDEX IF NOT EXISTS idx_kb_slug         ON kb_articles (slug);
CREATE INDEX IF NOT EXISTS idx_kb_audiencia    ON kb_articles USING GIN (audiencia);
CREATE INDEX IF NOT EXISTS idx_kb_tipo_aplica  ON kb_articles USING GIN (tipo_aplica);

CREATE TABLE IF NOT EXISTS kb_article_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  contenido_md TEXT NOT NULL,
  resumen TEXT,
  modificado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  modificado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (article_id, version)
);

CREATE INDEX IF NOT EXISTS idx_kb_history_article
  ON kb_article_history (article_id, version DESC);

CREATE TABLE IF NOT EXISTS kb_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  viewer_user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES tickets_soporte(id) ON DELETE SET NULL,
  session_id TEXT,
  helpful BOOLEAN,
  deflected BOOLEAN,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_views_article ON kb_views (article_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_views_ticket  ON kb_views (ticket_id) WHERE ticket_id IS NOT NULL;

ALTER TABLE kb_articles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_article_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_views           ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS csat_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets_soporte(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  agente_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  estado estado_csat NOT NULL DEFAULT 'pendiente',
  csat_score INTEGER CHECK (csat_score BETWEEN 1 AND 5),
  ces_score INTEGER CHECK (ces_score BETWEEN 1 AND 7),
  comentario TEXT,
  enviado_at TIMESTAMPTZ,
  respondido_at TIMESTAMPTZ,
  expira_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_csat_ticket    ON csat_surveys (ticket_id);
CREATE INDEX        IF NOT EXISTS idx_csat_pending   ON csat_surveys (estado, expira_at) WHERE estado IN ('pendiente', 'enviado');
CREATE INDEX        IF NOT EXISTS idx_csat_cliente   ON csat_surveys (cliente_id, created_at DESC);
CREATE INDEX        IF NOT EXISTS idx_csat_agente    ON csat_surveys (agente_id, respondido_at DESC) WHERE agente_id IS NOT NULL;

ALTER TABLE csat_surveys ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS major_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  estado estado_mim NOT NULL DEFAULT 'declarado',
  declarado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  declarado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mitigado_at TIMESTAMPTZ,
  resuelto_at TIMESTAMPTZ,
  pir_url TEXT,
  servicios_afectados TEXT[] NOT NULL DEFAULT '{}',
  zonas_afectadas UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mim_estado_activos
  ON major_incidents (estado)
  WHERE estado IN ('declarado', 'mitigando', 'pir_pendiente');

CREATE INDEX IF NOT EXISTS idx_mim_declarado_at
  ON major_incidents (declarado_at DESC);

CREATE TABLE IF NOT EXISTS major_incident_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  major_incident_id UUID NOT NULL REFERENCES major_incidents(id) ON DELETE CASCADE,
  contenido_md TEXT NOT NULL,
  estado_en_momento estado_mim NOT NULL,
  publicado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  publicado_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mim_update
  ON major_incident_updates (major_incident_id, publicado_at DESC);

CREATE TABLE IF NOT EXISTS ticket_major_incident_link (
  ticket_id UUID NOT NULL REFERENCES tickets_soporte(id) ON DELETE CASCADE,
  major_incident_id UUID NOT NULL REFERENCES major_incidents(id) ON DELETE CASCADE,
  vinculado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  vinculado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  PRIMARY KEY (ticket_id, major_incident_id)
);

CREATE INDEX IF NOT EXISTS idx_tmim_mim
  ON ticket_major_incident_link (major_incident_id);

ALTER TABLE major_incidents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE major_incident_updates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_major_incident_link ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS canned_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  contenido_md TEXT NOT NULL,
  categoria cat_ticket,
  tipo_aplica tipo_ticket[] NOT NULL DEFAULT '{}',
  variables_disponibles TEXT[] NOT NULL DEFAULT '{cliente.nombre,orden.id,agente.nombre}',
  scope_grupo TEXT,
  uso_count INTEGER NOT NULL DEFAULT 0 CHECK (uso_count >= 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canned_categoria ON canned_responses (categoria, activo);
CREATE INDEX IF NOT EXISTS idx_canned_scope     ON canned_responses (scope_grupo, activo);
CREATE INDEX IF NOT EXISTS idx_canned_tipo      ON canned_responses USING GIN (tipo_aplica);

ALTER TABLE canned_responses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  ALTER TABLE mensajes_ticket
    ADD CONSTRAINT fk_msg_canned
    FOREIGN KEY (canned_response_id)
    REFERENCES canned_responses(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO permisos (clave, descripcion, modulo) VALUES
  ('soporte.tickets.ver_todos',    'Ver tickets de cualquier agente del equipo', 'soporte'),
  ('soporte.tickets.escalar_l2',   'Escalar ticket de L1 a L2', 'soporte'),
  ('soporte.tickets.escalar_l3',   'Escalar ticket a L3', 'soporte'),
  ('soporte.tickets.cerrar',       'Cerrar ticket con codigo de resolucion y notas', 'soporte'),
  ('soporte.problem.ver',          'Ver tickets tipo problema', 'soporte'),
  ('soporte.problem.crear',        'Crear o convertir incident en problem', 'soporte'),
  ('soporte.problem.vincular',     'Vincular incident a problem existente', 'soporte'),
  ('soporte.kb.ver',               'Ver articulos KB internos', 'soporte'),
  ('soporte.kb.editar',            'Crear o editar articulos KB', 'soporte'),
  ('soporte.kb.publicar',          'Publicar articulo KB', 'soporte'),
  ('soporte.canned.gestionar',     'CRUD de canned responses', 'soporte'),
  ('soporte.mim.declarar',         'Declarar Major Incident', 'soporte'),
  ('soporte.mim.publicar_update',  'Publicar update en Major Incident', 'soporte'),
  ('soporte.mim.cerrar',           'Cerrar Major Incident con PIR link', 'soporte'),
  ('soporte.sla.gestionar',        'Editar politicas y calendarios SLA', 'soporte'),
  ('soporte.metricas.equipo',      'Ver metricas de todo el equipo de soporte', 'soporte')
ON CONFLICT (clave) DO NOTHING;

WITH pairs(rol_nombre, permiso_clave) AS (VALUES
  
  ('super_admin',      'soporte.tickets.ver_todos'),
  ('soporte',          'soporte.tickets.ver_todos'),
  
  ('super_admin',      'soporte.tickets.escalar_l2'),
  ('soporte',          'soporte.tickets.escalar_l2'),
  ('agente_soporte',   'soporte.tickets.escalar_l2'),
  
  ('super_admin',      'soporte.tickets.escalar_l3'),
  ('soporte',          'soporte.tickets.escalar_l3'),
  
  ('super_admin',      'soporte.tickets.cerrar'),
  ('soporte',          'soporte.tickets.cerrar'),
  ('agente_soporte',   'soporte.tickets.cerrar'),
  
  ('super_admin',      'soporte.problem.ver'),
  ('soporte',          'soporte.problem.ver'),
  
  ('super_admin',      'soporte.problem.crear'),
  ('soporte',          'soporte.problem.crear'),
  
  ('super_admin',      'soporte.problem.vincular'),
  ('soporte',          'soporte.problem.vincular'),
  ('agente_soporte',   'soporte.problem.vincular'),
  
  ('super_admin',      'soporte.kb.ver'),
  ('soporte',          'soporte.kb.ver'),
  ('agente_soporte',   'soporte.kb.ver'),
  ('finanzas',         'soporte.kb.ver'),
  ('analista_finanzas','soporte.kb.ver'),
  
  ('super_admin',      'soporte.kb.editar'),
  ('soporte',          'soporte.kb.editar'),
  
  ('super_admin',      'soporte.kb.publicar'),
  
  ('super_admin',      'soporte.canned.gestionar'),
  ('soporte',          'soporte.canned.gestionar'),
  
  ('super_admin',      'soporte.mim.declarar'),
  ('soporte',          'soporte.mim.declarar'),
  
  ('super_admin',      'soporte.mim.publicar_update'),
  ('soporte',          'soporte.mim.publicar_update'),
  
  ('super_admin',      'soporte.mim.cerrar'),
  
  ('super_admin',      'soporte.sla.gestionar'),
  
  ('super_admin',      'soporte.metricas.equipo'),
  ('soporte',          'soporte.metricas.equipo')
)
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM pairs
JOIN roles_admin r ON r.nombre = pairs.rol_nombre
JOIN permisos    p ON p.clave  = pairs.permiso_clave
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

CREATE OR REPLACE FUNCTION trg_tickets_auto_assign_grupo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.grupo_asignado IS NULL THEN
    NEW.grupo_asignado := CASE
      WHEN NEW.categoria::text = 'cobro_incorrecto' THEN 'finanzas_l2'
      WHEN NEW.categoria::text IN ('dano_propiedad', 'queja_servicio') THEN 'soporte_l1'
      WHEN NEW.categoria::text = 'no_show' THEN 'operaciones_l1'
      ELSE 'soporte_l1'
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tickets_auto_assign_grupo_trigger ON tickets_soporte;
CREATE TRIGGER tickets_auto_assign_grupo_trigger
  BEFORE INSERT ON tickets_soporte
  FOR EACH ROW EXECUTE FUNCTION trg_tickets_auto_assign_grupo();

CREATE OR REPLACE FUNCTION trg_tickets_bootstrap_sla()
RETURNS TRIGGER AS $$
DECLARE
  v_policy sla_policies%ROWTYPE;
  v_frt_minutes INTEGER;
  v_ttr_minutes INTEGER;
BEGIN
  
  SELECT * INTO v_policy
    FROM sla_policies
   WHERE activo = TRUE
     AND tipo = NEW.tipo
     AND prioridad = NEW.prioridad
     AND (categoria = NEW.categoria OR categoria IS NULL)
   ORDER BY (categoria = NEW.categoria) DESC NULLS LAST
   LIMIT 1;

  IF v_policy.id IS NULL THEN
    
    RETURN NEW;
  END IF;

  v_frt_minutes := v_policy.frt_minutos;
  v_ttr_minutes := v_policy.ttr_minutos;

  INSERT INTO ticket_sla_state (ticket_id, policy_id, frt_due_at, ttr_due_at)
  VALUES (
    NEW.id,
    v_policy.id,
    NEW.created_at + (v_frt_minutes || ' minutes')::INTERVAL,
    NEW.created_at + (v_ttr_minutes || ' minutes')::INTERVAL
  )
  ON CONFLICT (ticket_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tickets_bootstrap_sla_trigger ON tickets_soporte;
CREATE TRIGGER tickets_bootstrap_sla_trigger
  AFTER INSERT ON tickets_soporte
  FOR EACH ROW EXECUTE FUNCTION trg_tickets_bootstrap_sla();

CREATE OR REPLACE FUNCTION trg_kb_articles_history()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.titulo IS DISTINCT FROM NEW.titulo)
     OR (OLD.contenido_md IS DISTINCT FROM NEW.contenido_md)
     OR (OLD.resumen IS DISTINCT FROM NEW.resumen) THEN

    INSERT INTO kb_article_history (
      article_id, version, titulo, contenido_md, resumen, modificado_por
    ) VALUES (
      OLD.id, OLD.version, OLD.titulo, OLD.contenido_md, OLD.resumen, OLD.autor_id
    );

    NEW.version := OLD.version + 1;
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kb_articles_history_trigger ON kb_articles;
CREATE TRIGGER kb_articles_history_trigger
  BEFORE UPDATE ON kb_articles
  FOR EACH ROW EXECUTE FUNCTION trg_kb_articles_history();

CREATE OR REPLACE FUNCTION trg_mim_block_close_if_open_tickets()
RETURNS TRIGGER AS $$
DECLARE
  v_open_tickets INTEGER;
BEGIN
  IF NEW.estado = 'cerrado' AND OLD.estado <> 'cerrado' THEN
    SELECT COUNT(*) INTO v_open_tickets
      FROM ticket_major_incident_link tmim
      JOIN tickets_soporte t ON t.id = tmim.ticket_id
     WHERE tmim.major_incident_id = NEW.id
       AND t.estatus::text NOT IN ('cerrado', 'resuelto', 'cancelado');

    IF v_open_tickets > 0 THEN
      RAISE EXCEPTION 'No se puede cerrar Major Incident: % tickets vinculados siguen abiertos', v_open_tickets
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.pir_url IS NULL OR length(NEW.pir_url) = 0 THEN
      RAISE EXCEPTION 'No se puede cerrar Major Incident sin pir_url (Post-Incident Review)'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mim_block_close_trigger ON major_incidents;
CREATE TRIGGER mim_block_close_trigger
  BEFORE UPDATE ON major_incidents
  FOR EACH ROW EXECUTE FUNCTION trg_mim_block_close_if_open_tickets();

CREATE OR REPLACE FUNCTION trg_sla_mark_first_response()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo_autor::text = 'agente' AND NEW.es_interno = FALSE THEN
    UPDATE ticket_sla_state
       SET primer_respuesta_at = LEAST(COALESCE(primer_respuesta_at, NEW.created_at), NEW.created_at),
           updated_at = NOW()
     WHERE ticket_id = NEW.ticket_id
       AND primer_respuesta_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sla_first_response_trigger ON mensajes_ticket;
CREATE TRIGGER sla_first_response_trigger
  AFTER INSERT ON mensajes_ticket
  FOR EACH ROW EXECUTE FUNCTION trg_sla_mark_first_response();

CREATE OR REPLACE FUNCTION trg_sla_mark_resolved()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.estatus::text IN ('resuelto', 'cerrado'))
     AND (OLD.estatus::text NOT IN ('resuelto', 'cerrado')) THEN
    UPDATE ticket_sla_state
       SET resuelto_at = COALESCE(NEW.cerrado_at, NOW()),
           updated_at = NOW()
     WHERE ticket_id = NEW.id
       AND resuelto_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sla_resolve_trigger ON tickets_soporte;
CREATE TRIGGER sla_resolve_trigger
  AFTER UPDATE OF estatus ON tickets_soporte
  FOR EACH ROW EXECUTE FUNCTION trg_sla_mark_resolved();

DROP POLICY IF EXISTS escalation_select ON escalation_log_ticket;
CREATE POLICY escalation_select ON escalation_log_ticket
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS escalation_insert ON escalation_log_ticket;
CREATE POLICY escalation_insert ON escalation_log_ticket
  FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS sla_cal_select ON sla_calendars;
CREATE POLICY sla_cal_select ON sla_calendars
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS sla_cal_mutate ON sla_calendars;
CREATE POLICY sla_cal_mutate ON sla_calendars
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS sla_pol_select ON sla_policies;
CREATE POLICY sla_pol_select ON sla_policies
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS sla_pol_mutate ON sla_policies;
CREATE POLICY sla_pol_mutate ON sla_policies
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS sla_state_select ON ticket_sla_state;
CREATE POLICY sla_state_select ON ticket_sla_state
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS sla_state_mutate ON ticket_sla_state;
CREATE POLICY sla_state_mutate ON ticket_sla_state
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS kb_select ON kb_articles;
CREATE POLICY kb_select ON kb_articles
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS kb_mutate ON kb_articles;
CREATE POLICY kb_mutate ON kb_articles
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS kb_hist_select ON kb_article_history;
CREATE POLICY kb_hist_select ON kb_article_history
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS kb_views_insert ON kb_views;
CREATE POLICY kb_views_insert ON kb_views
  FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS kb_views_select ON kb_views;
CREATE POLICY kb_views_select ON kb_views
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS csat_select ON csat_surveys;
CREATE POLICY csat_select ON csat_surveys
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS csat_update_cliente ON csat_surveys;
CREATE POLICY csat_update_cliente ON csat_surveys
  FOR UPDATE USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS csat_insert ON csat_surveys;
CREATE POLICY csat_insert ON csat_surveys
  FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS mim_select ON major_incidents;
CREATE POLICY mim_select ON major_incidents
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS mim_mutate ON major_incidents;
CREATE POLICY mim_mutate ON major_incidents
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS mim_upd_select ON major_incident_updates;
CREATE POLICY mim_upd_select ON major_incident_updates
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS mim_upd_insert ON major_incident_updates;
CREATE POLICY mim_upd_insert ON major_incident_updates
  FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS tmim_select ON ticket_major_incident_link;
CREATE POLICY tmim_select ON ticket_major_incident_link
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS tmim_mutate ON ticket_major_incident_link;
CREATE POLICY tmim_mutate ON ticket_major_incident_link
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS canned_select ON canned_responses;
CREATE POLICY canned_select ON canned_responses
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS canned_mutate ON canned_responses;
CREATE POLICY canned_mutate ON canned_responses
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

INSERT INTO sla_calendars (nombre, timezone, config_jsonb)
VALUES (
  'CDMX_lun_vie_9_18',
  'America/Mexico_City',
  '{
    "mon":[{"start":"09:00","end":"18:00"}],
    "tue":[{"start":"09:00","end":"18:00"}],
    "wed":[{"start":"09:00","end":"18:00"}],
    "thu":[{"start":"09:00","end":"18:00"}],
    "fri":[{"start":"09:00","end":"18:00"}],
    "sat":[],
    "sun":[],
    "holidays":["2026-01-01","2026-02-02","2026-03-16","2026-05-01","2026-09-16","2026-11-16","2026-12-25"]
  }'::jsonb
)
ON CONFLICT (nombre) DO NOTHING;

WITH cal AS (SELECT id FROM sla_calendars WHERE nombre = 'CDMX_lun_vie_9_18')
INSERT INTO sla_policies (nombre, tipo, prioridad, categoria, frt_minutos, ttr_minutos, business_hours_only, calendar_id) VALUES
  ('incident_critica',  'incidente', 'critica', NULL, 15,   240,   FALSE, (SELECT id FROM cal)),
  ('incident_alta',     'incidente', 'alta',    NULL, 30,   480,   TRUE,  (SELECT id FROM cal)),
  ('incident_media',    'incidente', 'media',   NULL, 120,  1440,  TRUE,  (SELECT id FROM cal)),
  ('incident_baja',     'incidente', 'baja',    NULL, 240,  4320,  TRUE,  (SELECT id FROM cal)),
  ('solicitud_critica', 'solicitud', 'critica', NULL, 240,  2880,  TRUE,  (SELECT id FROM cal)),
  ('solicitud_alta',    'solicitud', 'alta',    NULL, 240,  2880,  TRUE,  (SELECT id FROM cal)),
  ('solicitud_media',   'solicitud', 'media',   NULL, 240,  2880,  TRUE,  (SELECT id FROM cal)),
  ('solicitud_baja',    'solicitud', 'baja',    NULL, 240,  2880,  TRUE,  (SELECT id FROM cal)),
  ('problema_critica',  'problema',  'critica', NULL, 1440, 20160, TRUE,  (SELECT id FROM cal)),
  ('problema_alta',     'problema',  'alta',    NULL, 1440, 20160, TRUE,  (SELECT id FROM cal)),
  ('problema_media',    'problema',  'media',   NULL, 1440, 20160, TRUE,  (SELECT id FROM cal)),
  ('problema_baja',     'problema',  'baja',    NULL, 1440, 20160, TRUE,  (SELECT id FROM cal))
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO kb_articles (slug, titulo, contenido_md, resumen, categoria, tipo_aplica, audiencia, tier_minimo, publicado, publicado_en) VALUES
  (
    'como-solicitar-reembolso',
    'Como solicitar un reembolso',
    E'# Como solicitar un reembolso\n\nSi tu pedido no llego o llego incorrecto, sigue estos pasos:\n\n1. Abre la app y ve a "Mis pedidos".\n2. Selecciona el pedido afectado.\n3. Toca "Solicitar reembolso".\n4. Adjunta evidencia (foto, captura) si aplica.\n5. Confirma. Recibiras respuesta en menos de 24h habiles.\n\n## Casos cubiertos\n- Pedido no entregado\n- Pedido danado\n- Cargo duplicado\n\n## Casos no cubiertos\n- Cambios de opinion despues de entrega exitosa.',
    'Pasos para solicitar reembolso desde la app movil.',
    'cobro_incorrecto',
    ARRAY['solicitud']::tipo_ticket[],
    ARRAY['cliente','agente_l1']::audiencia_kb[],
    'l1',
    TRUE,
    NOW()
  ),
  (
    'procedimiento-escalacion-l1-l2',
    'Procedimiento de escalacion L1 -> L2',
    E'# Procedimiento de escalacion L1 -> L2\n\nAntes de escalar, el agente L1 debe completar:\n\n1. **Diagnostico inicial** documentado en notas internas.\n2. **Consultar KB** y registrar articulos consultados.\n3. **Aplicar workaround conocido** si existe.\n4. **Hipotesis de ≥20 caracteres** sobre causa probable.\n\n## Cuando NO escalar\n- Si el problema esta cubierto por KB.\n- Si no se ha intentado el workaround estandar.\n- Si el cliente no respondio en 24h (cerrar como sin_respuesta_cliente).\n\n## Como escalar\nUsa el dialog "Escalar a L2" en el ticket. Selecciona motivo, escribe hipotesis, marca KB consultados. La accion queda registrada en escalation_log_ticket.',
    'Pasos obligatorios antes de escalar un ticket de L1 a L2.',
    NULL,
    ARRAY['incidente','solicitud']::tipo_ticket[],
    ARRAY['agente_l1','agente_l2_l3']::audiencia_kb[],
    'l1',
    TRUE,
    NOW()
  )
ON CONFLICT (slug) DO NOTHING;

INSERT INTO canned_responses (slug, titulo, contenido_md, categoria, tipo_aplica, scope_grupo, variables_disponibles) VALUES
  (
    'pago-no-recibido-solicitar-referencia',
    'Pago no recibido - solicitar referencia',
    E'Hola {{cliente.nombre}},\n\nGracias por contactarnos sobre el pedido {{orden.id}}. Para verificar el pago, comparteme por favor:\n\n- Captura del comprobante o referencia\n- Fecha y hora del pago\n- Banco o metodo utilizado\n\nEn cuanto tenga la referencia confirmo el estatus.\n\nSaludos,\n{{agente.nombre}}',
    'cobro_incorrecto',
    ARRAY['solicitud','incidente']::tipo_ticket[],
    'soporte_l1',
    ARRAY['cliente.nombre','orden.id','agente.nombre']
  ),
  (
    'confirmar-resolucion-y-csat',
    'Confirmar resolucion y enviar CSAT',
    E'Hola {{cliente.nombre}},\n\nMe alegra confirmar que tu solicitud sobre el pedido {{orden.id}} esta resuelta. En unos minutos recibiras una breve encuesta para evaluar el servicio - tu feedback nos ayuda a mejorar.\n\nSi requieres algo mas, responde este ticket en las proximas 72 horas.\n\nGracias por tu paciencia.\n\n{{agente.nombre}}',
    NULL,
    ARRAY['incidente','solicitud']::tipo_ticket[],
    NULL,
    ARRAY['cliente.nombre','orden.id','agente.nombre']
  )
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION trg_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER touch_sla_calendars BEFORE UPDATE ON sla_calendars
    FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER touch_sla_policies BEFORE UPDATE ON sla_policies
    FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER touch_sla_state BEFORE UPDATE ON ticket_sla_state
    FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER touch_mim BEFORE UPDATE ON major_incidents
    FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER touch_canned BEFORE UPDATE ON canned_responses
    FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TYPE tipo_ticket            IS 'Discriminator ITIL: incidente|solicitud|problema|cambio';
COMMENT ON TYPE tier_soporte           IS 'Tier escalation: l1|l2|l3';
COMMENT ON TYPE estatus_ticket_v2      IS 'Estados extendidos ITIL. Phase 2 migra desde estatus_ticket.';
COMMENT ON TYPE codigo_resolucion      IS 'Codigo obligatorio al cerrar ticket.';

COMMENT ON COLUMN tickets_soporte.tipo            IS 'Tipo ITIL del ticket. Discriminator para campos especificos.';
COMMENT ON COLUMN tickets_soporte.tier_actual     IS 'Tier donde el ticket vive ahora. Cambia con escalations.';
COMMENT ON COLUMN tickets_soporte.grupo_asignado  IS 'Grupo logico (soporte_l1, finanzas_l2, dev_l3). Auto-set por trigger segun categoria.';
COMMENT ON COLUMN tickets_soporte.problem_id      IS 'Self-FK: incidente recurrente vinculado a problem master.';
COMMENT ON COLUMN tickets_soporte.workaround_md   IS 'Solo tipo=problema. Documentado para que L1/L2 lo apliquen.';
COMMENT ON COLUMN tickets_soporte.causa_raiz_md   IS 'Solo tipo=problema. RCA.';
COMMENT ON COLUMN tickets_soporte.fix_permanente_md IS 'Solo tipo=problema. Plan de fix definitivo.';

COMMENT ON TABLE escalation_log_ticket IS 'Audit trail de escalations entre tiers. Hipotesis ≥20 chars obligatoria.';
COMMENT ON TABLE sla_calendars         IS 'Calendarios laborales. config_jsonb shape: {mon:[{start,end}], holidays:[]}';
COMMENT ON TABLE sla_policies          IS 'Reglas SLA por tipo+prioridad+categoria. Match preferred-categoria-first.';
COMMENT ON TABLE ticket_sla_state      IS 'Estado SLA por ticket. Cron jobs notifican breaches via campos notified_*.';
COMMENT ON TABLE kb_articles           IS 'Knowledge Base. tsvector multi-lang Spanish weighted A>B>C. Versioning via trigger.';
COMMENT ON TABLE kb_views              IS 'Tracking de uso para metric deflection_rate (KB resolvio sin ticket).';
COMMENT ON TABLE csat_surveys          IS 'Una encuesta por ticket cerrado (UNIQUE). CSAT 1-5, CES 1-7. Expiry 7 dias.';
COMMENT ON TABLE major_incidents       IS 'MIM workflow. Cierre exige pir_url + cero tickets vinculados abiertos.';
COMMENT ON TABLE canned_responses      IS 'Templates con variables {{cliente.nombre}} interpolated en client/server.';

COMMIT;

