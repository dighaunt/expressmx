

BEGIN;

DO $$ BEGIN
  CREATE TYPE action_status_ticket AS ENUM (
    'ninguno',
    'esperando_cliente',
    'esperando_aprobacion',
    'esperando_finanzas',
    'esperando_operaciones',
    'esperando_legal',
    'esperando_proveedor',
    'esperando_visita_tecnico'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_tarea_caso AS ENUM (
    'reembolso',
    'cfdi_cancelacion',
    'cfdi_reemision',
    'credito_aplicacion',
    'reasignar_prestador',
    'investigacion_pago',
    'callback_cliente',
    'verificacion_id',
    'follow_up_interno'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estado_tarea_caso AS ENUM (
    'abierta',
    'en_progreso',
    'esperando_aprobacion',
    'bloqueada',
    'completada',
    'cancelada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estado_aprobacion AS ENUM (
    'solicitada',
    'aprobada',
    'rechazada',
    'cancelada',
    'expirada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_movimiento_saldo AS ENUM (
    'credito_manual',
    'credito_compensacion',
    'aplicacion_orden',
    'reverso',
    'ajuste_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE motivo_suspension AS ENUM (
    'fraude_sospechoso',
    'incumplimiento_pago',
    'abuso_servicio',
    'queja_prestador',
    'verificacion_pendiente',
    'a_solicitud_cliente'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE severidad_anotacion AS ENUM (
    'info',
    'media',
    'alta',
    'critica'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_recordatorio AS ENUM (
    'callback_cliente',
    'follow_up_interno',
    'reabrir_ticket',
    'ejecutar_tarea'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.tickets_soporte
  ADD COLUMN IF NOT EXISTS action_status public.action_status_ticket NOT NULL DEFAULT 'ninguno',
  ADD COLUMN IF NOT EXISTS action_status_motivo text,
  ADD COLUMN IF NOT EXISTS action_status_desde timestamp with time zone,
  ADD COLUMN IF NOT EXISTS resolucion_subcodigo text;

COMMENT ON COLUMN public.tickets_soporte.action_status IS 'Estado interno de espera. Pausa SLA sin cambiar estatus visible al cliente. Inspirado en ServiceNow Action Status.';
COMMENT ON COLUMN public.tickets_soporte.resolucion_subcodigo IS 'Sub-clasificacion libre para reportes 2-nivel. Ej: codigo=resuelto_directo + subcodigo=explicacion_telefono.';

CREATE TABLE IF NOT EXISTS public.tareas_caso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets_soporte(id) ON DELETE CASCADE,
  tipo public.tipo_tarea_caso NOT NULL,
  estado public.estado_tarea_caso NOT NULL DEFAULT 'abierta',
  asunto text NOT NULL,
  descripcion_md text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  asignado_a uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  grupo_asignado text NOT NULL,
  creado_por uuid NOT NULL REFERENCES public.usuarios(id),
  vence_at timestamp with time zone,
  bloqueante boolean NOT NULL DEFAULT false,
  completada_at timestamp with time zone,
  completada_por uuid REFERENCES public.usuarios(id),
  resultado_md text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tareas_caso_resultado_si_completada CHECK (
    (estado IN ('completada','cancelada') AND resultado_md IS NOT NULL) OR
    (estado NOT IN ('completada','cancelada'))
  )
);

CREATE INDEX IF NOT EXISTS idx_tareas_caso_ticket
  ON public.tareas_caso(ticket_id);

CREATE INDEX IF NOT EXISTS idx_tareas_caso_grupo_estado
  ON public.tareas_caso(grupo_asignado, estado)
  WHERE estado IN ('abierta','en_progreso','esperando_aprobacion');

CREATE INDEX IF NOT EXISTS idx_tareas_caso_vence
  ON public.tareas_caso(vence_at)
  WHERE estado IN ('abierta','en_progreso');

CREATE INDEX IF NOT EXISTS idx_tareas_caso_asignado
  ON public.tareas_caso(asignado_a, estado)
  WHERE estado IN ('abierta','en_progreso','esperando_aprobacion');

COMMENT ON TABLE public.tareas_caso IS 'Sub-tareas cross-team de un ticket. Patron ServiceNow Case Task. Bloqueante=true impide cierre del ticket.';
COMMENT ON COLUMN public.tareas_caso.payload IS 'Datos especificos del tipo: monto, factura_id, prestador_id, etc.';
COMMENT ON COLUMN public.tareas_caso.bloqueante IS 'Si true, ticket no puede pasar a resuelto mientras esta tarea este abierta.';

CREATE TABLE IF NOT EXISTS public.aprobaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad text NOT NULL,
  entidad_id uuid NOT NULL,
  motivo_md text NOT NULL,
  monto_mxn numeric(10,2),
  solicitado_por uuid NOT NULL REFERENCES public.usuarios(id),
  aprobador_grupo text NOT NULL,
  aprobador_user uuid REFERENCES public.usuarios(id),
  estado public.estado_aprobacion NOT NULL DEFAULT 'solicitada',
  decidida_at timestamp with time zone,
  notas_decision_md text,
  expira_at timestamp with time zone NOT NULL DEFAULT (now() + interval '72 hours'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT aprobaciones_decision_completa CHECK (
    (estado IN ('aprobada','rechazada') AND aprobador_user IS NOT NULL AND decidida_at IS NOT NULL)
    OR estado IN ('solicitada','cancelada','expirada')
  ),
  CONSTRAINT aprobaciones_entidad_valida CHECK (
    entidad IN ('reembolsos','tareas_caso','saldo_cliente_movimientos','suspensiones_cuenta')
  )
);

CREATE INDEX IF NOT EXISTS idx_aprobaciones_pendientes
  ON public.aprobaciones(aprobador_grupo, created_at)
  WHERE estado = 'solicitada';

CREATE INDEX IF NOT EXISTS idx_aprobaciones_entidad
  ON public.aprobaciones(entidad, entidad_id);

CREATE INDEX IF NOT EXISTS idx_aprobaciones_expira
  ON public.aprobaciones(expira_at)
  WHERE estado = 'solicitada';

COMMENT ON TABLE public.aprobaciones IS 'Aprobaciones polimorficas. Patron sysapproval_approver de ServiceNow. Cualquier entidad puede pedir aprobacion via (entidad, entidad_id).';

CREATE TABLE IF NOT EXISTS public.saldo_cliente_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  tipo public.tipo_movimiento_saldo NOT NULL,
  monto_mxn numeric(10,2) NOT NULL,
  motivo_md text NOT NULL,
  ticket_id uuid REFERENCES public.tickets_soporte(id) ON DELETE SET NULL,
  orden_id uuid REFERENCES public.ordenes_servicio(id) ON DELETE SET NULL,
  reverso_de uuid REFERENCES public.saldo_cliente_movimientos(id),
  creado_por uuid NOT NULL REFERENCES public.usuarios(id),
  aprobacion_id uuid REFERENCES public.aprobaciones(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT saldo_mov_signo_correcto CHECK (
    (tipo IN ('credito_manual','credito_compensacion') AND monto_mxn > 0) OR
    (tipo = 'aplicacion_orden' AND monto_mxn < 0) OR
    (tipo IN ('reverso','ajuste_admin'))
  )
);

CREATE INDEX IF NOT EXISTS idx_saldo_mov_cliente
  ON public.saldo_cliente_movimientos(cliente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saldo_mov_ticket
  ON public.saldo_cliente_movimientos(ticket_id)
  WHERE ticket_id IS NOT NULL;

COMMENT ON TABLE public.saldo_cliente_movimientos IS 'Ledger inmutable del saldo de cada cliente. Insert-only. Reversion via tipo=reverso apuntando a reverso_de.';

CREATE OR REPLACE VIEW public.v_saldo_cliente AS
SELECT
  cliente_id,
  COALESCE(SUM(monto_mxn), 0)::numeric(12,2) AS saldo_mxn,
  COUNT(*) AS movimientos_total,
  MAX(created_at) AS ultimo_movimiento_at
FROM public.saldo_cliente_movimientos
GROUP BY cliente_id;

COMMENT ON VIEW public.v_saldo_cliente IS 'Balance derivado del ledger. Cliente sin movimientos no aparece (LEFT JOIN para incluirlo con 0).';

CREATE TABLE IF NOT EXISTS public.suspensiones_cuenta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  motivo public.motivo_suspension NOT NULL,
  notas_md text NOT NULL,
  ticket_id uuid REFERENCES public.tickets_soporte(id) ON DELETE SET NULL,
  ventana_inicio timestamp with time zone NOT NULL DEFAULT now(),
  ventana_fin timestamp with time zone,
  creada_por uuid NOT NULL REFERENCES public.usuarios(id),
  reactivada_at timestamp with time zone,
  reactivada_por uuid REFERENCES public.usuarios(id),
  reactivacion_motivo_md text,
  aprobacion_id uuid REFERENCES public.aprobaciones(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT suspensiones_ventana_valida CHECK (
    ventana_fin IS NULL OR ventana_fin > ventana_inicio
  ),
  CONSTRAINT suspensiones_reactivacion_completa CHECK (
    (reactivada_at IS NULL AND reactivada_por IS NULL AND reactivacion_motivo_md IS NULL) OR
    (reactivada_at IS NOT NULL AND reactivada_por IS NOT NULL AND reactivacion_motivo_md IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_suspensiones_activas
  ON public.suspensiones_cuenta(usuario_id)
  WHERE reactivada_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_suspensiones_ventana
  ON public.suspensiones_cuenta(ventana_fin)
  WHERE reactivada_at IS NULL AND ventana_fin IS NOT NULL;

COMMENT ON TABLE public.suspensiones_cuenta IS 'Suspensiones con motivo + ventana. Trigger sync usuarios.activo. Reactivacion es row update, no delete.';

CREATE TABLE IF NOT EXISTS public.cliente_anotaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  severidad public.severidad_anotacion NOT NULL DEFAULT 'info',
  titulo text NOT NULL,
  cuerpo_md text NOT NULL,
  expira_at timestamp with time zone,
  creada_por uuid NOT NULL REFERENCES public.usuarios(id),
  eliminada_at timestamp with time zone,
  eliminada_por uuid REFERENCES public.usuarios(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anotaciones_cliente_activas
  ON public.cliente_anotaciones(cliente_id)
  WHERE eliminada_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_anotaciones_severidad_activas
  ON public.cliente_anotaciones(cliente_id, severidad)
  WHERE eliminada_at IS NULL;

COMMENT ON TABLE public.cliente_anotaciones IS 'Special handling notes. Severidad alta/critica dispara banner arriba del ticket. Soft delete via eliminada_at.';

CREATE TABLE IF NOT EXISTS public.tickets_watchers (
  ticket_id uuid NOT NULL REFERENCES public.tickets_soporte(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  agregado_por uuid NOT NULL REFERENCES public.usuarios(id),
  agregado_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_watchers_user
  ON public.tickets_watchers(user_id);

COMMENT ON TABLE public.tickets_watchers IS 'Stakeholders notificados de cada cambio publico/cierre del ticket sin estar asignados.';

CREATE TABLE IF NOT EXISTS public.recordatorios_soporte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets_soporte(id) ON DELETE CASCADE,
  tipo public.tipo_recordatorio NOT NULL,
  disparar_at timestamp with time zone NOT NULL,
  para_user uuid NOT NULL REFERENCES public.usuarios(id),
  asunto text NOT NULL,
  notas_md text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  creado_por uuid NOT NULL REFERENCES public.usuarios(id),
  disparado_at timestamp with time zone,
  cancelado_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recordatorios_pendientes
  ON public.recordatorios_soporte(disparar_at)
  WHERE disparado_at IS NULL AND cancelado_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_recordatorios_para_user
  ON public.recordatorios_soporte(para_user, disparar_at)
  WHERE disparado_at IS NULL AND cancelado_at IS NULL;

COMMENT ON TABLE public.recordatorios_soporte IS 'Recordatorios programados (callback, follow-up). Cron 5min escanea pendientes y dispara notif.';

CREATE OR REPLACE FUNCTION public.fn_sync_usuarios_activo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reactivada_at IS NULL THEN
    UPDATE public.usuarios SET activo = false WHERE id = NEW.usuario_id;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.suspensiones_cuenta
      WHERE usuario_id = NEW.usuario_id
        AND reactivada_at IS NULL
        AND id != NEW.id
    ) THEN
      UPDATE public.usuarios SET activo = true WHERE id = NEW.usuario_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_sync_usuarios_activo
    AFTER INSERT OR UPDATE ON public.suspensiones_cuenta
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_usuarios_activo();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.fn_block_close_with_tasks()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estatus = 'resuelto' AND OLD.estatus != 'resuelto' THEN
    IF EXISTS (
      SELECT 1 FROM public.tareas_caso
      WHERE ticket_id = NEW.id
        AND bloqueante = true
        AND estado IN ('abierta', 'en_progreso', 'esperando_aprobacion')
    ) THEN
      RAISE EXCEPTION 'No se puede resolver el ticket: hay tareas bloqueantes abiertas. Completa o cancela las tareas primero.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_block_close_with_tasks
    BEFORE UPDATE ON public.tickets_soporte
    FOR EACH ROW EXECUTE FUNCTION public.fn_block_close_with_tasks();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.trg_touch_updated_at_remediation()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER touch_tareas_caso BEFORE UPDATE ON public.tareas_caso
    FOR EACH ROW EXECUTE FUNCTION public.trg_touch_updated_at_remediation();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO public.permisos (clave, modulo, descripcion) VALUES
  ('soporte.tarea.crear',                'soporte',  'Crear sub-tarea cross-team desde un ticket'),
  ('soporte.tarea.completar',            'soporte',  'Completar tarea propia del agente'),
  ('soporte.reembolso.solicitar_inline', 'soporte',  'Crear solicitud de reembolso desde el ticket workspace'),
  ('soporte.reembolso.aprobar_express',  'soporte',  'Aprobar reembolsos hasta umbral configurado'),
  ('soporte.credito.aplicar',            'soporte',  'Aplicar credito en cuenta del cliente'),
  ('soporte.credito.aplicar_sin_aprobacion', 'soporte', 'Saltar aprobacion para creditos hasta umbral'),
  ('soporte.suspender_cuenta',           'soporte',  'Suspender cuenta de cliente con motivo + ventana'),
  ('soporte.reactivar_cuenta',           'soporte',  'Reactivar cuenta antes del fin de ventana'),
  ('soporte.anotacion.crear',            'soporte',  'Agregar special handling note a un cliente'),
  ('soporte.anotacion.eliminar',         'soporte',  'Soft delete de anotacion'),
  ('soporte.cfdi.solicitar_cancelacion', 'soporte',  'Crear tarea para que finanzas cancele CFDI ante el SAT'),
  ('soporte.recordatorio.crear',         'soporte',  'Programar recordatorio (callback / follow-up)')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO public.roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM public.roles_admin r, public.permisos p
WHERE r.nombre = 'super_admin'
  AND p.clave IN (
    'soporte.tarea.crear',
    'soporte.tarea.completar',
    'soporte.reembolso.solicitar_inline',
    'soporte.reembolso.aprobar_express',
    'soporte.credito.aplicar',
    'soporte.credito.aplicar_sin_aprobacion',
    'soporte.suspender_cuenta',
    'soporte.reactivar_cuenta',
    'soporte.anotacion.crear',
    'soporte.anotacion.eliminar',
    'soporte.cfdi.solicitar_cancelacion',
    'soporte.recordatorio.crear'
  )
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

INSERT INTO public.roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM public.roles_admin r, public.permisos p
WHERE r.nombre = 'soporte'
  AND p.clave IN (
    'soporte.tarea.crear',
    'soporte.tarea.completar',
    'soporte.reembolso.solicitar_inline',
    'soporte.reembolso.aprobar_express',
    'soporte.credito.aplicar',
    'soporte.suspender_cuenta',
    'soporte.reactivar_cuenta',
    'soporte.anotacion.crear',
    'soporte.anotacion.eliminar',
    'soporte.cfdi.solicitar_cancelacion',
    'soporte.recordatorio.crear'
  )
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

INSERT INTO public.roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM public.roles_admin r, public.permisos p
WHERE r.nombre = 'agente_soporte'
  AND p.clave IN (
    'soporte.tarea.crear',
    'soporte.tarea.completar',
    'soporte.reembolso.solicitar_inline',
    'soporte.credito.aplicar',
    'soporte.anotacion.crear',
    'soporte.recordatorio.crear'
  )
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

INSERT INTO public.roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM public.roles_admin r, public.permisos p
WHERE r.nombre IN ('finanzas', 'operaciones')
  AND p.clave = 'soporte.tarea.completar'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

INSERT INTO public.config_sistema (clave, valor, tipo_dato, descripcion) VALUES
  ('reembolso_express_max_mxn',  '500',  'number', 'Maximo MXN que soporte L2 puede reembolsar sin aprobacion finanzas'),
  ('credito_express_max_mxn',    '300',  'number', 'Maximo MXN de credito en cuenta sin aprobacion'),
  ('suspension_express_max_dias', '7',   'number', 'Maximo dias de suspension sin aprobacion super_admin'),
  ('aprobacion_default_ttl_horas', '72', 'number', 'Tiempo default de expiracion de una aprobacion')
ON CONFLICT (clave) DO NOTHING;

DO $$
DECLARE
  admin_id uuid;
  legacy_count int;
BEGIN
  SELECT u.id INTO admin_id
  FROM public.usuarios u
  JOIN public.roles_admin r ON r.nombre = 'super_admin'
  WHERE u.activo = true
  ORDER BY u.created_at ASC
  LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE NOTICE 'No super_admin found, skipping legacy suspension backfill. Run manually if needed.';
    RETURN;
  END IF;

  INSERT INTO public.suspensiones_cuenta (
    usuario_id, motivo, notas_md, ventana_inicio, ventana_fin, creada_por
  )
  SELECT
    u.id,
    'a_solicitud_cliente'::motivo_suspension,
    'Migrado desde estado legacy. Motivo original: ' || COALESCE(u.motivo_restriccion, 'sin registro'),
    COALESCE(u.updated_at, u.created_at),
    NULL,
    admin_id
  FROM public.usuarios u
  WHERE u.activo = false
    AND NOT EXISTS (
      SELECT 1 FROM public.suspensiones_cuenta s
      WHERE s.usuario_id = u.id AND s.reactivada_at IS NULL
    );

  GET DIAGNOSTICS legacy_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % legacy suspensiones', legacy_count;
END $$;

COMMENT ON TYPE public.action_status_ticket IS 'Estado interno de espera. Pausa SLA sin cambiar estatus visible. Inspirado en ServiceNow Action Status.';
COMMENT ON TYPE public.tipo_tarea_caso     IS 'Tipos de sub-tareas cross-team. Cada tipo tiene grupo_asignado por defecto en aplicacion.';
COMMENT ON TYPE public.estado_aprobacion   IS 'Lifecycle de una solicitud de aprobacion: solicitada -> aprobada/rechazada/cancelada/expirada.';
COMMENT ON TYPE public.tipo_movimiento_saldo IS 'Tipos de movimiento en el ledger. credito_* > 0; aplicacion_orden < 0; reverso/ajuste_admin sin restriccion de signo.';

COMMIT;

