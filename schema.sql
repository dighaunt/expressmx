

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE SCHEMA public;

CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
  CREATE ROLE anon;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE ROLE authenticated;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.role', true), '');
$$;

CREATE TYPE public.audiencia_kb AS ENUM (
    'cliente',
    'agente_l1',
    'agente_l2_l3',
    'admin'
);

CREATE TYPE public.canal_notif AS ENUM (
    'orden',
    'promo',
    'sistema'
);

CREATE TYPE public.cat_ticket AS ENUM (
    'cobro_incorrecto',
    'no_show',
    'dano_propiedad',
    'queja_servicio',
    'otro'
);

CREATE TYPE public.codigo_resolucion AS ENUM (
    'resuelto_directo',
    'kb_resuelto',
    'reembolso_emitido',
    'duplicado',
    'no_aplica',
    'no_reproducible',
    'sin_respuesta_cliente'
);

CREATE TYPE public.dia_semana AS ENUM (
    'lun',
    'mar',
    'mie',
    'jue',
    'vie',
    'sab',
    'dom'
);

CREATE TYPE public.escalation_motivo AS ENUM (
    'fuera_alcance',
    'requiere_autorizacion',
    'requiere_dev',
    'sla_breach',
    'cliente_solicitud'
);

CREATE TYPE public.estado_csat AS ENUM (
    'pendiente',
    'enviado',
    'respondido',
    'expirado'
);

CREATE TYPE public.estado_mim AS ENUM (
    'declarado',
    'mitigando',
    'resuelto',
    'pir_pendiente',
    'cerrado'
);

CREATE TYPE public.estatus_cargo_extra AS ENUM (
    'propuesto',
    'aceptado',
    'rechazado'
);

CREATE TYPE public.estatus_corte AS ENUM (
    'generado',
    'revisado',
    'depositado'
);

CREATE TYPE public.estatus_deposito AS ENUM (
    'pendiente',
    'depositado'
);

CREATE TYPE public.estatus_documento AS ENUM (
    'pendiente',
    'aprobado',
    'rechazado'
);

CREATE TYPE public.estatus_factura AS ENUM (
    'timbrada',
    'cancelada',
    'pendiente_timbrado',
    'fallida'
);

CREATE TYPE public.estatus_orden AS ENUM (
    'solicitada',
    'asignada',
    'en_camino',
    'en_progreso',
    'completada',
    'cancelada'
);

CREATE TYPE public.estatus_pago AS ENUM (
    'pendiente',
    'procesado',
    'fallido',
    'reembolsado'
);

CREATE TYPE public.estatus_reembolso AS ENUM (
    'solicitado',
    'aprobado',
    'rechazado',
    'procesado'
);

CREATE TYPE public.estatus_ticket AS ENUM (
    'abierto',
    'en_revision',
    'resuelto',
    'escalado'
);

CREATE TYPE public.estatus_ticket_v2 AS ENUM (
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

CREATE TYPE public.estatus_zona AS ENUM (
    'activa',
    'en_expansion',
    'suspendida'
);

CREATE TYPE public.metodo_pago AS ENUM (
    'tarjeta',
    'efectivo',
    'transferencia'
);

CREATE TYPE public.prioridad_ticket AS ENUM (
    'baja',
    'media',
    'alta',
    'critica'
);

CREATE TYPE public.rol_usuario AS ENUM (
    'cliente',
    'prestador',
    'admin'
);

CREATE TYPE public.segmento_banner AS ENUM (
    'todos',
    'nuevos',
    'recurrentes'
);

CREATE TYPE public.tier_soporte AS ENUM (
    'l1',
    'l2',
    'l3'
);

CREATE TYPE public.tipo_ajuste AS ENUM (
    'multiplicador',
    'monto_fijo'
);

CREATE TYPE public.tipo_autor_msg AS ENUM (
    'usuario',
    'agente',
    'sistema'
);

CREATE TYPE public.tipo_descuento AS ENUM (
    'porcentaje',
    'monto_fijo'
);

CREATE TYPE public.tipo_documento AS ENUM (
    'ine',
    'domicilio',
    'certificacion',
    'curp'
);

CREATE TYPE public.tipo_notif AS ENUM (
    'push',
    'sms',
    'email'
);

CREATE TYPE public.tipo_ticket AS ENUM (
    'incidente',
    'solicitud',
    'problema',
    'cambio'
);

CREATE FUNCTION public.abrir_acceso_perfil(_usuario_id uuid, _pin text, _challenge text, _motivo text, _ip inet DEFAULT NULL::inet, _ua text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _admin_id UUID := auth.uid();
  _pin_row public.pins_soporte%ROWTYPE;
  _target public.usuarios%ROWTYPE;
  _challenge_ok BOOLEAN;
  _acceso_id UUID;
BEGIN
  IF _admin_id IS NULL THEN
    RAISE EXCEPTION 'no_auth' USING ERRCODE = '42501';
  END IF;

  IF NOT public.tiene_permiso('usuarios.acceder_perfil') THEN
    RAISE EXCEPTION 'sin_permiso' USING ERRCODE = '42501';
  END IF;

  IF length(btrim(_motivo)) < 10 THEN
    RAISE EXCEPTION 'motivo_muy_corto' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _pin_row FROM public.pins_soporte WHERE admin_id = _admin_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pin_no_configurado' USING ERRCODE = '22023';
  END IF;

  IF _pin_row.bloqueado_hasta IS NOT NULL AND _pin_row.bloqueado_hasta > NOW() THEN
    RAISE EXCEPTION 'pin_bloqueado' USING ERRCODE = '22023';
  END IF;

  IF _pin_row.pin_hash <> crypt(_pin, _pin_row.pin_hash) THEN
    UPDATE public.pins_soporte
    SET intentos_fallidos = intentos_fallidos + 1,
        bloqueado_hasta = CASE
          WHEN intentos_fallidos + 1 >= 3 THEN NOW() + INTERVAL '10 minutes'
          ELSE bloqueado_hasta
        END
    WHERE admin_id = _admin_id;
    RAISE EXCEPTION 'pin_incorrecto' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _target FROM public.usuarios WHERE id = _usuario_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'usuario_no_existe' USING ERRCODE = '22023';
  END IF;
  _challenge_ok :=
    (_target.fecha_nacimiento IS NOT NULL AND _target.fecha_nacimiento::TEXT = btrim(_challenge))
    OR (_target.telefono IS NOT NULL AND right(_target.telefono, 4) = btrim(_challenge));

  IF NOT _challenge_ok THEN
    UPDATE public.pins_soporte
    SET intentos_fallidos = intentos_fallidos + 1
    WHERE admin_id = _admin_id;
    RAISE EXCEPTION 'challenge_incorrecto' USING ERRCODE = '22023';
  END IF;
  UPDATE public.pins_soporte
  SET intentos_fallidos = 0, bloqueado_hasta = NULL
  WHERE admin_id = _admin_id;

  UPDATE public.accesos_perfil_usuario
  SET revocado_en = NOW()
  WHERE admin_id = _admin_id AND revocado_en IS NULL AND expira_en > NOW();

  INSERT INTO public.accesos_perfil_usuario (admin_id, usuario_id, motivo, expira_en, ip_address, user_agent)
  VALUES (_admin_id, _usuario_id, btrim(_motivo), NOW() + INTERVAL '15 minutes', _ip, _ua)
  RETURNING id INTO _acceso_id;

  INSERT INTO public.logs_auditoria (admin_id, accion, entidad, entidad_id, valor_nuevo, ip_address, user_agent)
  VALUES (
    _admin_id,
    'acceso_perfil.abrir',
    'usuarios',
    _usuario_id,
    jsonb_build_object('motivo', btrim(_motivo), 'acceso_id', _acceso_id),
    _ip,
    _ua
  );

  RETURN _acceso_id;
END;
$$;

CREATE FUNCTION public.distancia_km(p_lat1 numeric, p_lng1 numeric, p_lat2 numeric, p_lng2 numeric) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    RETURNS NULL ON NULL INPUT
    AS $$
  SELECT (
    6371 * 2 * ASIN(
      SQRT(
        POWER(SIN(RADIANS((p_lat2 - p_lat1)::double precision) / 2), 2) +
        COS(RADIANS(p_lat1::double precision)) *
        COS(RADIANS(p_lat2::double precision)) *
        POWER(SIN(RADIANS((p_lng2 - p_lng1)::double precision) / 2), 2)
      )
    )
  )::numeric;
$$;

CREATE FUNCTION public.zona_poligono_contiene(p_lat numeric, p_lng numeric, p_poligono jsonb) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    RETURNS NULL ON NULL INPUT
    AS $$
DECLARE
  v_ring jsonb;
  v_inside boolean := false;
  v_count integer;
  v_i integer;
  v_j integer;
  v_lat_i double precision;
  v_lng_i double precision;
  v_lat_j double precision;
  v_lng_j double precision;
  v_lat double precision := p_lat::double precision;
  v_lng double precision := p_lng::double precision;
BEGIN
  IF jsonb_typeof(p_poligono) != 'array'
     AND (p_poligono->>'type') IS DISTINCT FROM 'Polygon' THEN
    RETURN false;
  END IF;

  IF (p_poligono->>'type') = 'Polygon' THEN
    v_ring := p_poligono->'coordinates'->0;
  ELSIF jsonb_typeof(p_poligono->0->0) = 'array' THEN
    v_ring := p_poligono->0;
  ELSE
    v_ring := p_poligono;
  END IF;

  IF v_ring IS NULL OR jsonb_typeof(v_ring) != 'array' THEN
    RETURN false;
  END IF;

  v_count := jsonb_array_length(v_ring);
  IF v_count < 3 THEN
    RETURN false;
  END IF;

  v_j := v_count - 1;
  FOR v_i IN 0..(v_count - 1) LOOP
    v_lng_i := (v_ring->v_i->>0)::double precision;
    v_lat_i := (v_ring->v_i->>1)::double precision;
    v_lng_j := (v_ring->v_j->>0)::double precision;
    v_lat_j := (v_ring->v_j->>1)::double precision;

    IF ((v_lat_i > v_lat) <> (v_lat_j > v_lat))
       AND (
         v_lng <
         ((v_lng_j - v_lng_i) * (v_lat - v_lat_i) / NULLIF(v_lat_j - v_lat_i, 0) + v_lng_i)
       ) THEN
      v_inside := NOT v_inside;
    END IF;

    v_j := v_i;
  END LOOP;

  RETURN v_inside;
EXCEPTION
  WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN false;
END;
$$;

CREATE FUNCTION public.zona_cobertura_resuelve_punto(p_lat numeric, p_lng numeric) RETURNS TABLE(id uuid, nombre text, estatus public.estatus_zona, distancia_km numeric, radio_km numeric, match_tipo text)
    LANGUAGE sql STABLE
    AS $$
  SELECT
    z.id,
    z.nombre,
    z.estatus,
    public.distancia_km(p_lat, p_lng, z.centro_lat, z.centro_lng) AS distancia_km,
    z.radio_km,
    CASE
      WHEN z.poligono_coords IS NOT NULL
       AND public.zona_poligono_contiene(p_lat, p_lng, z.poligono_coords)
        THEN 'poligono'
      ELSE 'radio'
    END AS match_tipo
  FROM public.zonas_cobertura z
  WHERE p_lat IS NOT NULL
    AND p_lng IS NOT NULL
    AND (
      (
        z.poligono_coords IS NOT NULL
        AND public.zona_poligono_contiene(p_lat, p_lng, z.poligono_coords)
      )
      OR (
        z.radio_km IS NOT NULL
        AND public.distancia_km(p_lat, p_lng, z.centro_lat, z.centro_lng) <= z.radio_km
      )
    )
  ORDER BY
    CASE
      WHEN z.poligono_coords IS NOT NULL
       AND public.zona_poligono_contiene(p_lat, p_lng, z.poligono_coords)
        THEN 0
      ELSE 1
    END,
    z.radio_km ASC NULLS LAST,
    public.distancia_km(p_lat, p_lng, z.centro_lat, z.centro_lng) ASC,
    z.created_at DESC,
    z.id ASC
  LIMIT 1;
$$;

CREATE FUNCTION public.zona_operativa_para_punto(p_lat numeric, p_lng numeric, p_servicio_id uuid DEFAULT NULL::uuid, p_fecha date DEFAULT CURRENT_DATE) RETURNS TABLE(zona_id uuid, zona_nombre text, distancia_km numeric, tarifa_id uuid, tipo_ajuste public.tipo_ajuste, valor numeric)
    LANGUAGE sql STABLE
    AS $$
  WITH zona AS (
    SELECT *
    FROM public.zona_cobertura_resuelve_punto(p_lat, p_lng)
    WHERE estatus = 'activa'::public.estatus_zona
    LIMIT 1
  )
  SELECT
    z.id AS zona_id,
    z.nombre AS zona_nombre,
    z.distancia_km,
    t.id AS tarifa_id,
    t.tipo_ajuste,
    t.valor
  FROM zona z
  LEFT JOIN LATERAL (
    SELECT tz.id, tz.tipo_ajuste, tz.valor
    FROM public.tarifas_zona tz
    WHERE tz.zona_id = z.id
      AND tz.servicio_id = p_servicio_id
      AND tz.activa IS TRUE
      AND tz.vigencia_inicio <= p_fecha
      AND (tz.vigencia_fin IS NULL OR tz.vigencia_fin >= p_fecha)
    ORDER BY tz.vigencia_inicio DESC, tz.id DESC
    LIMIT 1
  ) t ON p_servicio_id IS NOT NULL;
$$;

CREATE FUNCTION public.validar_prestador_para_orden(p_orden_id uuid, p_prestador_id uuid) RETURNS TABLE(elegible boolean, motivo text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  DECLARE
    v_servicio_id UUID;
    v_inicio TIMESTAMPTZ;
    v_fin TIMESTAMPTZ;
    v_lat NUMERIC;
    v_lng NUMERIC;
    v_inicio_local TIMESTAMP;
    v_fin_local TIMESTAMP;
    v_dia dia_semana;
    v_hora_inicio TIME;
    v_hora_fin TIME;
    v_prestador RECORD;
  BEGIN
    SELECT o.servicio_id, o.fecha_programada,
           o.fecha_programada + (COALESCE(s.duracion_estimada_min, 60) || ' minutes')::interval,
           d.latitud, d.longitud
    INTO v_servicio_id, v_inicio, v_fin, v_lat, v_lng
    FROM public.ordenes_servicio o
    JOIN public.servicios s ON s.id = o.servicio_id
    JOIN public.direcciones d ON d.id = o.direccion_id
    WHERE o.id = p_orden_id;

    IF NOT FOUND THEN
      RETURN QUERY SELECT FALSE, 'Orden no encontrada';
      RETURN;
    END IF;

    SELECT rol::text AS rol, activo, recibe_ordenes, restringido_en
    INTO v_prestador
    FROM public.usuarios
    WHERE id = p_prestador_id;

    IF NOT FOUND THEN
      RETURN QUERY SELECT FALSE, 'Prestador no encontrado';
      RETURN;
    END IF;

    IF v_prestador.rol != 'prestador' THEN
      RETURN QUERY SELECT FALSE, 'Esa cuenta no es de prestador';
      RETURN;
    END IF;

    IF v_prestador.activo IS NOT TRUE OR v_prestador.recibe_ordenes IS NOT TRUE OR v_prestador.restringido_en IS NOT NULL THEN
      RETURN QUERY SELECT FALSE, 'El prestador está inactivo, restringido o no acepta órdenes nuevas';
      RETURN;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.servicios_prestador sp
      WHERE sp.prestador_id = p_prestador_id
        AND sp.servicio_id = v_servicio_id
        AND sp.activo = TRUE
    ) THEN
      RETURN QUERY SELECT FALSE, 'El prestador no ofrece este servicio';
      RETURN;
    END IF;

    v_inicio_local := v_inicio AT TIME ZONE 'America/Mexico_City';
    v_fin_local := v_fin AT TIME ZONE 'America/Mexico_City';
    v_hora_inicio := v_inicio_local::time;
    v_hora_fin := v_fin_local::time;
    v_dia := CASE EXTRACT(ISODOW FROM v_inicio_local)::int
      WHEN 1 THEN 'lun'::dia_semana
      WHEN 2 THEN 'mar'::dia_semana
      WHEN 3 THEN 'mie'::dia_semana
      WHEN 4 THEN 'jue'::dia_semana
      WHEN 5 THEN 'vie'::dia_semana
      WHEN 6 THEN 'sab'::dia_semana
      ELSE 'dom'::dia_semana
    END;

    IF EXISTS (SELECT 1 FROM public.disponibilidad_prestador dp WHERE dp.prestador_id = p_prestador_id)
       AND NOT EXISTS (
         SELECT 1
         FROM public.disponibilidad_prestador dp
         WHERE dp.prestador_id = p_prestador_id
           AND dp.dia = v_dia
           AND v_inicio_local::date = v_fin_local::date
           AND dp.hora_inicio <= v_hora_inicio
           AND dp.hora_fin >= v_hora_fin
           AND (
             v_lat IS NULL
             OR v_lng IS NULL
             OR dp.zona_lat IS NULL
             OR dp.zona_lng IS NULL
             OR (
               SQRT(
                 POW((dp.zona_lat - v_lat)::NUMERIC * 111, 2) +
                 POW((dp.zona_lng - v_lng)::NUMERIC * 111 * COS(RADIANS(v_lat::NUMERIC)), 2)
               ) <= COALESCE(dp.radio_cobertura_km, 10)
             )
           )
       ) THEN
      RETURN QUERY SELECT FALSE, 'El prestador no tiene disponibilidad para el horario o zona';
      RETURN;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.ordenes_servicio ox
      JOIN public.servicios sx ON sx.id = ox.servicio_id
      WHERE ox.prestador_id = p_prestador_id
        AND ox.id != p_orden_id
        AND ox.estatus NOT IN ('completada', 'cancelada')
        AND tstzrange(
          ox.fecha_programada,
          ox.fecha_programada + (COALESCE(sx.duracion_estimada_min, 60) || ' minutes')::interval
        ) && tstzrange(v_inicio, v_fin)
    ) THEN
      RETURN QUERY SELECT FALSE, 'El prestador ya tiene una orden traslapada';
      RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, NULL::text;
  END;
  $$;

CREATE FUNCTION public.asignar_prestador_auto(p_orden_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$                                                                                                                                                                     
  DECLARE                                                   
    v_servicio_id UUID;
    v_lat NUMERIC;
    v_lng NUMERIC;
    v_prestador_id UUID;                                                                                                                                                    
    v_estatus_actual estatus_orden;                         
    v_prestador_existente UUID;                                                                                                                                             
  BEGIN
    SELECT o.servicio_id, o.estatus, o.prestador_id, d.latitud, d.longitud
    INTO v_servicio_id, v_estatus_actual, v_prestador_existente, v_lat, v_lng
    FROM public.ordenes_servicio o                                                                                                                                          
    JOIN public.direcciones d ON d.id = o.direccion_id
    WHERE o.id = p_orden_id;                                                                                                                                                
                                                            
    IF NOT FOUND THEN RETURN NULL; END IF;                                                                                                                                  
    IF v_prestador_existente IS NOT NULL THEN RETURN v_prestador_existente; END IF;
    IF v_estatus_actual != 'solicitada' THEN RETURN NULL; END IF;                                                                                                           
                                                                                                                                                                            
    WITH candidatos AS (                                                                                                                                                    
      SELECT u.id AS prestador_id,
             (                                                                                                                                                              
               SELECT COUNT(*) FROM public.ordenes_servicio oa
               WHERE oa.prestador_id = u.id
                 AND oa.estatus IN ('asignada', 'en_camino', 'en_progreso')                                                                                                 
             ) AS carga_activa,
             (                                                                                                                                                              
               SELECT COUNT(*) FROM public.ordenes_servicio oa
               WHERE oa.prestador_id = u.id                                                                                                                                 
                 AND oa.estatus = 'asignada'
                 AND oa.fecha_programada > NOW()                                                                                                                            
             ) AS carga_futura,
             (
               SELECT ROUND(AVG(c.puntuacion)::NUMERIC, 2)
               FROM public.calificaciones c
               WHERE c.calificado_id = u.id
             ) AS rating,
             (
               SELECT COUNT(*) FROM public.ordenes_servicio oc
               WHERE oc.prestador_id = u.id
                 AND oc.estatus = 'completada'
             ) AS completadas,
             (
               SELECT MIN(
                 SQRT(
                   POW((dp.zona_lat - v_lat)::NUMERIC * 111, 2) +
                   POW((dp.zona_lng - v_lng)::NUMERIC * 111 * COS(RADIANS(v_lat::NUMERIC)), 2)
                 )
               )
               FROM public.disponibilidad_prestador dp
               WHERE dp.prestador_id = u.id
                 AND v_lat IS NOT NULL
                 AND v_lng IS NOT NULL
                 AND dp.zona_lat IS NOT NULL
                 AND dp.zona_lng IS NOT NULL
             ) AS distancia_km
      FROM public.usuarios u
      CROSS JOIN LATERAL public.validar_prestador_para_orden(p_orden_id, u.id) elegibilidad
      WHERE elegibilidad.elegible = TRUE
    )                                                                                                                                                                       
    SELECT prestador_id INTO v_prestador_id                 
    FROM candidatos                                                                                                                                                         
    ORDER BY carga_activa ASC,
             carga_futura ASC,
             distancia_km ASC NULLS LAST,
             rating DESC NULLS LAST,
             completadas DESC,
             RANDOM()
    LIMIT 1;                                                                                                                                                                
                                                            
    IF v_prestador_id IS NULL THEN RETURN NULL; END IF;                                                                                                                     
   
    UPDATE public.ordenes_servicio                                                                                                                                          
    SET prestador_id = v_prestador_id,                      
        estatus = 'asignada',                                                                                                                                               
        updated_at = NOW()
    WHERE id = p_orden_id                                                                                                                                                   
      AND prestador_id IS NULL                              
      AND estatus = 'solicitada';
                                                                                                                                                                            
    IF NOT FOUND THEN RETURN NULL; END IF;
                                                                                                                                                                            
    INSERT INTO public.historial_estatus_orden (            
      orden_id, estatus_anterior, estatus_nuevo, cambiado_por, nota
    )                                                                                                                                                                       
    VALUES (
      p_orden_id, 'solicitada', 'asignada', NULL, 'Asignación automática'                                                                                                   
    );                                                                                                                                                                      
   
    RETURN v_prestador_id;                                                                                                                                                  
  END;                                                      
  $$;

CREATE FUNCTION public.cerrar_orden_con_pines(p_orden_id uuid, p_pin_cliente_ingresado text, p_pin_prestador_ingresado text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  DECLARE                                                                                                                                                                   
    v_pin_cliente TEXT;                                     
    v_pin_prestador TEXT;
    v_estatus estatus_orden;                                                                                                                                                
  BEGIN
    SELECT pin_cliente, pin_prestador, estatus                                                                                                                              
    INTO v_pin_cliente, v_pin_prestador, v_estatus                                                                                                                          
    FROM public.ordenes_servicio
    WHERE id = p_orden_id                                                                                                                                                   
    FOR UPDATE;                                                                                                                                                             
   
    IF NOT FOUND THEN                                                                                                                                                       
      RAISE EXCEPTION 'Orden no encontrada';                
    END IF;                                                                                                                                                                 
   
    IF v_estatus != 'en_progreso' THEN                                                                                                                                      
      RAISE EXCEPTION 'La orden no está en progreso (estatus actual: %)', v_estatus;
    END IF;                                                                                                                                                                 
   
    IF v_pin_cliente IS NULL OR v_pin_prestador IS NULL THEN                                                                                                                
      RAISE EXCEPTION 'Pines no configurados';              
    END IF;                                                                                                                                                                 
                                                            
    IF v_pin_cliente != p_pin_cliente_ingresado THEN                                                                                                                        
      RAISE EXCEPTION 'Pin del cliente incorrecto';
    END IF;                                                                                                                                                                 
                                                            
    IF v_pin_prestador != p_pin_prestador_ingresado THEN                                                                                                                    
      RAISE EXCEPTION 'Pin del prestador incorrecto';       
    END IF;                                                                                                                                                                 
   
    UPDATE public.ordenes_servicio                                                                                                                                          
    SET estatus = 'completada', updated_at = NOW()          
    WHERE id = p_orden_id;                                                                                                                                                  
   
    INSERT INTO public.historial_estatus_orden (                                                                                                                            
      orden_id, estatus_anterior, estatus_nuevo, cambiado_por, nota
    )                                                                                                                                                                       
    VALUES (                                                
      p_orden_id, v_estatus, 'completada', auth.uid(), 'Cierre con pin dual'                                                                                                
    );                                                                                                                                                                      
  END;
  $$;

CREATE FUNCTION public.consumir_codigo_invitacion(p_codigo text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  inv RECORD;
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('consumido', false, 'motivo', 'Sesión requerida');
  END IF;

  SELECT * INTO inv FROM public.invitaciones_prestadores
  WHERE codigo = UPPER(BTRIM(p_codigo))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('consumido', false, 'motivo', 'Código no existe');
  END IF;
  IF inv.revocada_en IS NOT NULL THEN
    RETURN jsonb_build_object('consumido', false, 'motivo', 'Código revocado');
  END IF;
  IF inv.usado_en IS NOT NULL THEN
    RETURN jsonb_build_object('consumido', false, 'motivo', 'Código ya utilizado');
  END IF;
  IF inv.expira_en < NOW() THEN
    RETURN jsonb_build_object('consumido', false, 'motivo', 'Código expirado');
  END IF;

  UPDATE public.invitaciones_prestadores
  SET usado_en = NOW(), usado_por = uid
  WHERE id = inv.id;

  RETURN jsonb_build_object('consumido', true);
END;
$$;

CREATE FUNCTION public.es_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios_admin
    WHERE usuario_id = (SELECT auth.uid()) AND activo = TRUE
  );
$$;

CREATE FUNCTION public.generar_codigo_invitacion(p_notas text DEFAULT NULL::text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  alfabeto TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  codigo_generado TEXT;
  intentos INT := 0;
BEGIN
  IF NOT (SELECT public.es_admin()) THEN
    RAISE EXCEPTION 'Solo administradores pueden generar códigos';
  END IF;

  LOOP
    codigo_generado := '';
    FOR i IN 1..8 LOOP
      codigo_generado := codigo_generado
        || substr(alfabeto, 1 + floor(random() * length(alfabeto))::INT, 1);
    END LOOP;

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.invitaciones_prestadores WHERE codigo = codigo_generado
    );

    intentos := intentos + 1;
    IF intentos > 10 THEN
      RAISE EXCEPTION 'No se pudo generar un código único tras 10 intentos';
    END IF;
  END LOOP;

  INSERT INTO public.invitaciones_prestadores (codigo, creado_por, notas)
  VALUES (codigo_generado, auth.uid(), p_notas);

  RETURN codigo_generado;
END;
$$;

CREATE FUNCTION public.generar_pines_orden() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN                                                                                                                                                                     
    IF NEW.pin_cliente IS NULL THEN                         
      NEW.pin_cliente := LPAD((FLOOR(RANDOM() * 900000) + 100000)::TEXT, 6, '0');                                                                                           
    END IF;                                                                                                                                                                 
    IF NEW.pin_prestador IS NULL THEN                                                                                                                                       
      NEW.pin_prestador := LPAD((FLOOR(RANDOM() * 900000) + 100000)::TEXT, 6, '0');                                                                                         
    END IF;                                                                                                                                                                 
    RETURN NEW;
  END;                                                                                                                                                                      
  $$;

CREATE FUNCTION public.handle_new_auth_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  nombre_usuario TEXT;
  apellidos_usuario TEXT;
  rol_metadata TEXT;
  codigo_metadata TEXT;
  curp_metadata TEXT;
  fecha_nacimiento_metadata DATE;
  invitacion RECORD;
BEGIN
  nombre_usuario := COALESCE(
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'nombre'), ''),
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    'Usuario'
  );

  apellidos_usuario := COALESCE(
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'apellidos'), ''),
    ''
  );

  rol_metadata := NULLIF(BTRIM(NEW.raw_user_meta_data->>'rol'), '');
  codigo_metadata := NULLIF(BTRIM(NEW.raw_user_meta_data->>'codigo_invitacion'), '');
  curp_metadata := UPPER(NULLIF(BTRIM(NEW.raw_user_meta_data->>'curp'), ''));

  BEGIN
    fecha_nacimiento_metadata := NULLIF(BTRIM(NEW.raw_user_meta_data->>'fecha_nacimiento'), '')::DATE;
  EXCEPTION WHEN OTHERS THEN
    fecha_nacimiento_metadata := NULL;
  END;

  IF rol_metadata = 'prestador' THEN
    IF codigo_metadata IS NULL THEN
      RAISE EXCEPTION 'Se requiere código de invitación para registrarse como prestador';
    END IF;

    SELECT * INTO invitacion
    FROM public.invitaciones_prestadores
    WHERE codigo = UPPER(codigo_metadata)
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Código de invitación no existe';
    END IF;
    IF invitacion.revocada_en IS NOT NULL THEN
      RAISE EXCEPTION 'Código de invitación revocado';
    END IF;
    IF invitacion.usado_en IS NOT NULL THEN
      RAISE EXCEPTION 'Código de invitación ya utilizado';
    END IF;
    IF invitacion.expira_en < NOW() THEN
      RAISE EXCEPTION 'Código de invitación expirado';
    END IF;

    IF curp_metadata IS NULL THEN
      RAISE EXCEPTION 'La CURP es obligatoria para prestadores';
    END IF;
    IF curp_metadata !~ '^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9A-Z][0-9]$' THEN
      RAISE EXCEPTION 'La CURP no tiene el formato oficial';
    END IF;

    IF fecha_nacimiento_metadata IS NULL THEN
      RAISE EXCEPTION 'La fecha de nacimiento es obligatoria para prestadores';
    END IF;
    IF fecha_nacimiento_metadata > (CURRENT_DATE - INTERVAL '18 years') THEN
      RAISE EXCEPTION 'El prestador debe ser mayor de edad';
    END IF;

    UPDATE public.invitaciones_prestadores
    SET usado_en = NOW(), usado_por = NEW.id
    WHERE id = invitacion.id;
  END IF;

  INSERT INTO public.usuarios (
    id, nombre, apellidos, email, telefono, rol, activo, curp, fecha_nacimiento
  )
  VALUES (
    NEW.id,
    nombre_usuario,
    apellidos_usuario,
    NEW.email,
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'telefono'), ''),
    CASE
      WHEN rol_metadata IN ('cliente', 'prestador', 'admin') THEN rol_metadata::rol_usuario
      ELSE 'cliente'::rol_usuario
    END,
    TRUE,
    curp_metadata,
    fecha_nacimiento_metadata
  )
  ON CONFLICT (id) DO UPDATE
  SET
    nombre = EXCLUDED.nombre,
    apellidos = EXCLUDED.apellidos,
    email = EXCLUDED.email,
    telefono = EXCLUDED.telefono,
    rol = EXCLUDED.rol,
    activo = EXCLUDED.activo,
    curp = COALESCE(EXCLUDED.curp, public.usuarios.curp),
    fecha_nacimiento = COALESCE(EXCLUDED.fecha_nacimiento, public.usuarios.fecha_nacimiento),
    updated_at = NOW();

  RETURN NEW;
END;
$_$;

CREATE FUNCTION public.resolver_cargo_extra(p_cargo_id uuid, p_aceptar boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$                                                                                                                                                                     
  DECLARE                                                   
    v_orden_id UUID;
    v_cliente_id UUID;
    v_monto NUMERIC(10, 2);                                                                                                                                                 
    v_estatus_cargo estatus_cargo_extra;
    v_estatus_orden estatus_orden;                                                                                                                                          
  BEGIN                                                     
    SELECT c.orden_id, c.monto, c.estatus, o.cliente_id, o.estatus                                                                                                          
    INTO v_orden_id, v_monto, v_estatus_cargo, v_cliente_id, v_estatus_orden                                                                                                
    FROM public.cargos_extra_orden c                                                                                                                                        
    JOIN public.ordenes_servicio o ON o.id = c.orden_id                                                                                                                     
    WHERE c.id = p_cargo_id                                                                                                                                                 
    FOR UPDATE OF c;                                        
                                                                                                                                                                            
    IF NOT FOUND THEN                                                                                                                                                       
      RAISE EXCEPTION 'Cargo no encontrado';
    END IF;                                                                                                                                                                 
                                                            
    IF v_cliente_id != auth.uid() THEN                                                                                                                                      
      RAISE EXCEPTION 'No autorizado';
    END IF;                                                                                                                                                                 
                                                            
    IF v_estatus_cargo != 'propuesto' THEN                                                                                                                                  
      RAISE EXCEPTION 'El cargo ya fue resuelto';
    END IF;                                                                                                                                                                 
                                                            
    IF v_estatus_orden NOT IN ('en_camino', 'en_progreso') THEN                                                                                                             
      RAISE EXCEPTION 'La orden no admite cargos (estatus: %)', v_estatus_orden;
    END IF;                                                                                                                                                                 
                                                            
    UPDATE public.cargos_extra_orden                                                                                                                                        
    SET estatus = CASE WHEN p_aceptar THEN 'aceptado'::estatus_cargo_extra
                       ELSE 'rechazado'::estatus_cargo_extra END,                                                                                                           
        resuelto_por = auth.uid(),                                                                                                                                          
        resuelto_at = NOW()                                                                                                                                                 
    WHERE id = p_cargo_id;                                                                                                                                                  
                                                                                                                                                                            
    IF p_aceptar THEN
      UPDATE public.ordenes_servicio                                                                                                                                        
      SET monto_total = monto_total + v_monto,              
          updated_at = NOW()                                                                                                                                                
      WHERE id = v_orden_id;
    END IF;                                                                                                                                                                 
  END;                                                                                                                                                                      
  $$;

CREATE FUNCTION public.revocar_acceso_perfil(_acceso_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _caller UUID := auth.uid();
  _acceso public.accesos_perfil_usuario%ROWTYPE;
BEGIN
  SELECT * INTO _acceso FROM public.accesos_perfil_usuario WHERE id = _acceso_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF _acceso.admin_id <> _caller AND NOT public.tiene_permiso('usuarios.listar_completo') THEN
    RAISE EXCEPTION 'sin_permiso' USING ERRCODE = '42501';
  END IF;

  UPDATE public.accesos_perfil_usuario
  SET revocado_en = COALESCE(revocado_en, NOW())
  WHERE id = _acceso_id;

  INSERT INTO public.logs_auditoria (admin_id, accion, entidad, entidad_id)
  VALUES (_caller, 'acceso_perfil.revocar', 'usuarios', _acceso.usuario_id);
END;
$$;

CREATE FUNCTION public.revocar_codigo_invitacion(p_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  inv RECORD;
BEGIN
  IF NOT (SELECT public.es_admin()) THEN
    RAISE EXCEPTION 'Solo administradores pueden revocar códigos';
  END IF;

  SELECT * INTO inv FROM public.invitaciones_prestadores
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('revocada', false, 'motivo', 'No existe');
  END IF;
  IF inv.usado_en IS NOT NULL THEN
    RETURN jsonb_build_object('revocada', false, 'motivo', 'Ya fue canjeada');
  END IF;
  IF inv.revocada_en IS NOT NULL THEN
    RETURN jsonb_build_object('revocada', false, 'motivo', 'Ya estaba revocada');
  END IF;

  UPDATE public.invitaciones_prestadores
  SET revocada_en = NOW(), revocada_por = auth.uid()
  WHERE id = p_id;

  RETURN jsonb_build_object('revocada', true);
END;
$$;

CREATE FUNCTION public.rotar_pin_soporte(_admin_id uuid, _pin_nuevo text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  _caller UUID := auth.uid();
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'no_auth' USING ERRCODE = '42501';
  END IF;

  IF _caller <> _admin_id AND NOT public.tiene_permiso('usuarios.listar_completo') THEN
    RAISE EXCEPTION 'sin_permiso' USING ERRCODE = '42501';
  END IF;

  IF _pin_nuevo !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'pin_formato_invalido' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.pins_soporte (admin_id, pin_hash, rotado_en, rotado_por)
  VALUES (_admin_id, crypt(_pin_nuevo, gen_salt('bf', 8)), NOW(), _caller)
  ON CONFLICT (admin_id) DO UPDATE
  SET pin_hash = EXCLUDED.pin_hash,
      intentos_fallidos = 0,
      bloqueado_hasta = NULL,
      rotado_en = NOW(),
      rotado_por = _caller;
END;
$_$;

CREATE FUNCTION public.show_db_tree() RETURNS TABLE(tree_structure text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT ':file_folder: ' || datname || ' (DATABASE)'
    FROM pg_database 
    WHERE datistemplate = false;
    RETURN QUERY
    WITH RECURSIVE 
    schemas AS (
        SELECT 
            n.nspname AS object_name,
            1 AS level,
            n.nspname AS path,
            'SCHEMA' AS object_type
        FROM pg_namespace n
        WHERE n.nspname NOT LIKE 'pg_%' 
        AND n.nspname != 'information_schema'
    ),
    objects AS (
        SELECT 
            c.relname AS object_name,
            2 AS level,
            s.path || ' → ' || c.relname AS path,
            CASE c.relkind
                WHEN 'r' THEN 'TABLE'
                WHEN 'v' THEN 'VIEW'
                WHEN 'm' THEN 'MATERIALIZED VIEW'
                WHEN 'i' THEN 'INDEX'
                WHEN 'S' THEN 'SEQUENCE'
                WHEN 'f' THEN 'FOREIGN TABLE'
            END AS object_type
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN schemas s ON n.nspname = s.object_name
        WHERE c.relkind IN ('r','v','m','i','S','f')

        UNION ALL

        SELECT 
            p.proname AS object_name,
            2 AS level,
            s.path || ' → ' || p.proname AS path,
            'FUNCTION' AS object_type
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        JOIN schemas s ON n.nspname = s.object_name
    ),
    combined AS (
        SELECT * FROM schemas
        UNION ALL
        SELECT * FROM objects
    )
    SELECT 
        REPEAT('    ', level) || 
        CASE 
            WHEN level = 1 THEN '└── :open_file_folder: '
            ELSE '    └── ' || 
                CASE object_type
                    WHEN 'TABLE' THEN ':bar_chart: '
                    WHEN 'VIEW' THEN ':eye: '
                    WHEN 'MATERIALIZED VIEW' THEN ':newspaper: '
                    WHEN 'FUNCTION' THEN ':zap: '
                    WHEN 'INDEX' THEN ':mag: '
                    WHEN 'SEQUENCE' THEN ':1234: '
                    WHEN 'FOREIGN TABLE' THEN ':globe_with_meridians: '
                    ELSE ''
                END
        END || object_name || ' (' || object_type || ')'
    FROM combined
    ORDER BY path;
END;
$$;

CREATE FUNCTION public.tiene_acceso_perfil(_usuario_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.accesos_perfil_usuario
    WHERE admin_id = (SELECT auth.uid())
      AND usuario_id = _usuario_id
      AND revocado_en IS NULL
      AND expira_en > NOW()
  );
$$;

CREATE FUNCTION public.tiene_permiso(_clave text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM usuarios_admin ua
    JOIN roles_permisos rp ON rp.rol_id = ua.rol_id
    JOIN permisos p ON p.id = rp.permiso_id
    WHERE ua.usuario_id = (SELECT auth.uid())
      AND ua.activo = TRUE
      AND p.clave = _clave
  );
$$;

CREATE FUNCTION public.trg_enforce_admin_rol() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.rol = 'admin' AND NOT EXISTS (
    SELECT 1 FROM usuarios_admin WHERE usuario_id = NEW.id AND activo = TRUE
  ) THEN
    RAISE EXCEPTION 'usuario_sin_rol_admin: asigna un rol en usuarios_admin primero';
  END IF;
  IF OLD.rol = 'admin' AND NEW.rol != 'admin' THEN
    UPDATE usuarios_admin SET activo = FALSE WHERE usuario_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.trg_kb_articles_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;

CREATE FUNCTION public.trg_mim_block_close_if_open_tickets() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;

CREATE FUNCTION public.trg_sla_mark_first_response() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;

CREATE FUNCTION public.trg_sla_mark_resolved() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;

CREATE FUNCTION public.trg_tickets_auto_assign_grupo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;

CREATE FUNCTION public.trg_tickets_bootstrap_sla() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;

CREATE FUNCTION public.trg_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.trg_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.trigger_asignar_prestador_auto() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$                                                                                                                                                                     
  BEGIN                                                     
    PERFORM public.asignar_prestador_auto(NEW.id);
    RETURN NEW;                                                                                                                                                             
  END;
  $$;

CREATE FUNCTION public.validar_codigo_invitacion(p_codigo text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  inv RECORD;
BEGIN
  SELECT * INTO inv FROM public.invitaciones_prestadores
  WHERE codigo = UPPER(BTRIM(p_codigo));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valido', false, 'motivo', 'Código no válido');
  END IF;
  IF inv.revocada_en IS NOT NULL THEN
    RETURN jsonb_build_object('valido', false, 'motivo', 'Código revocado');
  END IF;
  IF inv.usado_en IS NOT NULL THEN
    RETURN jsonb_build_object('valido', false, 'motivo', 'Código ya utilizado');
  END IF;
  IF inv.expira_en < NOW() THEN
    RETURN jsonb_build_object('valido', false, 'motivo', 'Código expirado');
  END IF;

  RETURN jsonb_build_object('valido', true, 'notas', inv.notas);
END;
$$;

SET default_tablespace = '';

SET default_table_access_method = heap;

CREATE TABLE public.accesos_perfil_usuario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    motivo text NOT NULL,
    expira_en timestamp with time zone NOT NULL,
    revocado_en timestamp with time zone,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT accesos_perfil_usuario_motivo_check CHECK ((length(btrim(motivo)) >= 10))
);

CREATE TABLE public.agencias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    rfc text,
    telefono text,
    email text,
    activa boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.banners_promocionales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    imagen_url text NOT NULL,
    url_destino text,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    orden_prioridad integer DEFAULT 0,
    segmento public.segmento_banner DEFAULT 'todos'::public.segmento_banner,
    activo boolean DEFAULT true,
    creado_por uuid,
    CONSTRAINT chk_fechas_banner CHECK ((fecha_fin >= fecha_inicio))
);

CREATE TABLE public.bancos_clabe (
    codigo text NOT NULL,
    nombre text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bancos_clabe_codigo_check CHECK ((codigo ~ '^[0-9]{3}$'::text)),
    CONSTRAINT bancos_clabe_nombre_check CHECK ((length(btrim(nombre)) >= 2))
);

CREATE TABLE public.calificaciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    orden_id uuid NOT NULL,
    calificador_id uuid NOT NULL,
    calificado_id uuid NOT NULL,
    puntuacion smallint NOT NULL,
    comentario text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT calificaciones_puntuacion_check CHECK (((puntuacion >= 1) AND (puntuacion <= 5)))
);

CREATE TABLE public.canned_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    titulo text NOT NULL,
    contenido_md text NOT NULL,
    categoria public.cat_ticket,
    tipo_aplica public.tipo_ticket[] DEFAULT '{}'::public.tipo_ticket[] NOT NULL,
    variables_disponibles text[] DEFAULT '{cliente.nombre,orden.id,agente.nombre}'::text[] NOT NULL,
    scope_grupo text,
    uso_count integer DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT canned_responses_uso_count_check CHECK ((uso_count >= 0))
);

CREATE TABLE public.cargos_extra_orden (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    orden_id uuid NOT NULL,
    descripcion text NOT NULL,
    monto numeric(10,2) NOT NULL,
    estatus public.estatus_cargo_extra DEFAULT 'propuesto'::public.estatus_cargo_extra NOT NULL,
    propuesto_por uuid NOT NULL,
    resuelto_por uuid,
    resuelto_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cargos_extra_orden_monto_check CHECK ((monto > (0)::numeric))
);

CREATE TABLE public.casos_soporte_abiertos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agente_id uuid NOT NULL,
    cliente_id uuid NOT NULL,
    pin_id uuid NOT NULL,
    abierto_en timestamp with time zone DEFAULT now() NOT NULL,
    expira_en timestamp with time zone DEFAULT (now() + '04:00:00'::interval) NOT NULL,
    cerrado_en timestamp with time zone,
    motivo_cierre text,
    notas text,
    ticket_id uuid
);

CREATE TABLE public.categorias_servicio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    icono_url text,
    orden_despliegue integer DEFAULT 0,
    activa boolean DEFAULT true
);

CREATE TABLE public.comisiones_plataforma (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    categoria_id uuid NOT NULL,
    porcentaje_base numeric(5,2) NOT NULL,
    porcentaje_volumen numeric(5,2),
    umbral_ordenes_mes integer,
    vigencia_inicio date NOT NULL,
    vigencia_fin date,
    activa boolean DEFAULT true
);

CREATE TABLE public.config_sistema (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clave text NOT NULL,
    valor text NOT NULL,
    tipo_dato text DEFAULT 'string'::text,
    descripcion text,
    modificado_por uuid,
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.cortes_pago (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prestador_id uuid NOT NULL,
    fecha_corte date NOT NULL,
    fecha_deposito date,
    monto_total numeric(12,2) NOT NULL,
    num_transacciones integer DEFAULT 0,
    estatus public.estatus_corte DEFAULT 'generado'::public.estatus_corte,
    referencia_bancaria text,
    aprobado_por uuid,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.cuentas_bancarias_prestador (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prestador_id uuid NOT NULL,
    titular text NOT NULL,
    banco_codigo text,
    banco_nombre text NOT NULL,
    clabe_ciphertext text NOT NULL,
    clabe_hash text NOT NULL,
    clabe_ultimos4 character varying(4) NOT NULL,
    estatus text DEFAULT 'pendiente'::text NOT NULL,
    verificada_en timestamp with time zone,
    rechazada_en timestamp with time zone,
    rechazo_motivo text,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cuentas_bancarias_prestador_banco_codigo_check CHECK (((banco_codigo IS NULL) OR (banco_codigo ~ '^[0-9]{3}$'::text))),
    CONSTRAINT cuentas_bancarias_prestador_banco_check CHECK ((length(btrim(banco_nombre)) >= 2)),
    CONSTRAINT cuentas_bancarias_prestador_clabe_ultimos4_check CHECK (((clabe_ultimos4)::text ~ '^[0-9]{4}$'::text)),
    CONSTRAINT cuentas_bancarias_prestador_estatus_check CHECK ((estatus = ANY (ARRAY['pendiente'::text, 'verificada'::text, 'rechazada'::text]))),
    CONSTRAINT cuentas_bancarias_prestador_titular_check CHECK ((length(btrim(titular)) >= 5))
);

CREATE TABLE public.csat_surveys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    cliente_id uuid NOT NULL,
    agente_id uuid,
    estado public.estado_csat DEFAULT 'pendiente'::public.estado_csat NOT NULL,
    csat_score integer,
    ces_score integer,
    comentario text,
    enviado_at timestamp with time zone,
    respondido_at timestamp with time zone,
    expira_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT csat_surveys_ces_score_check CHECK (((ces_score >= 1) AND (ces_score <= 7))),
    CONSTRAINT csat_surveys_csat_score_check CHECK (((csat_score >= 1) AND (csat_score <= 5)))
);

CREATE TABLE public.cupones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo text NOT NULL,
    tipo_descuento public.tipo_descuento NOT NULL,
    valor numeric(10,2) NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_expiracion date NOT NULL,
    usos_maximos integer DEFAULT 1,
    usos_actuales integer DEFAULT 0,
    solo_primera_compra boolean DEFAULT false,
    categoria_id uuid,
    CONSTRAINT chk_fechas CHECK ((fecha_expiracion >= fecha_inicio)),
    CONSTRAINT chk_usos CHECK ((usos_actuales <= usos_maximos))
);

CREATE TABLE public.direcciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    alias text,
    calle text NOT NULL,
    numero_ext text NOT NULL,
    numero_int text,
    colonia text NOT NULL,
    cp text NOT NULL,
    ciudad text NOT NULL,
    estado text NOT NULL,
    latitud numeric(10,7),
    longitud numeric(10,7),
    referencia text,
    predeterminada boolean DEFAULT false
);

CREATE TABLE public.disponibilidad_prestador (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prestador_id uuid NOT NULL,
    dia public.dia_semana NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    zona_lat numeric(10,7),
    zona_lng numeric(10,7),
    radio_cobertura_km numeric(6,2) DEFAULT 10.0,
    CONSTRAINT chk_horario CHECK ((hora_fin > hora_inicio))
);

CREATE TABLE public.documentos_prestador (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prestador_id uuid NOT NULL,
    tipo public.tipo_documento NOT NULL,
    archivo_url text NOT NULL,
    estatus public.estatus_documento DEFAULT 'pendiente'::public.estatus_documento,
    fecha_expiracion date,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.email_verificaciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    codigo text NOT NULL,
    expira_en timestamp with time zone NOT NULL,
    usado_en timestamp with time zone,
    intentos integer DEFAULT 0 NOT NULL,
    enviado_a text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_verificaciones_codigo_formato CHECK ((codigo ~ '^[0-9]{6}$'::text))
);

CREATE TABLE public.escalation_log_ticket (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    from_tier public.tier_soporte NOT NULL,
    to_tier public.tier_soporte NOT NULL,
    motivo public.escalation_motivo NOT NULL,
    hipotesis text NOT NULL,
    kb_consultados uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    from_user uuid NOT NULL,
    to_grupo text NOT NULL,
    to_user uuid,
    ocurrido_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT escalation_log_ticket_hipotesis_check CHECK ((length(hipotesis) >= 20))
);

CREATE TABLE public.evidencias_orden (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    orden_id uuid NOT NULL,
    url_foto text NOT NULL,
    subida_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    fase text DEFAULT 'antes'::text NOT NULL,
    CONSTRAINT evidencias_orden_fase_check CHECK ((fase = ANY (ARRAY['antes'::text, 'despues'::text])))
);

CREATE TABLE public.facturas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    orden_id uuid,
    corte_id uuid,
    rfc_emisor text NOT NULL,
    rfc_receptor text NOT NULL,
    uuid_cfdi text,
    subtotal numeric(12,2) NOT NULL,
    iva numeric(12,2) NOT NULL,
    total numeric(12,2) NOT NULL,
    pdf_url text,
    xml_url text,
    estatus public.estatus_factura DEFAULT 'timbrada'::public.estatus_factura,
    created_at timestamp with time zone DEFAULT now(),
    solicitada_por uuid,
    uso_cfdi text,
    forma_pago text,
    metodo_pago_sat text,
    serie text,
    folio text,
    pac_proveedor text,
    pac_referencia text,
    cancelada_at timestamp with time zone,
    cancelada_motivo text,
    xml_contenido text,
    pdf_contenido text,
    pago_id uuid
);

CREATE TABLE public.historial_estatus_orden (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    orden_id uuid NOT NULL,
    estatus_anterior public.estatus_orden,
    estatus_nuevo public.estatus_orden NOT NULL,
    cambiado_por uuid,
    nota text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.invitaciones_prestadores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo text NOT NULL,
    creado_por uuid,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    expira_en timestamp with time zone DEFAULT (now() + '14 days'::interval) NOT NULL,
    usado_en timestamp with time zone,
    usado_por uuid,
    notas text,
    revocada_en timestamp with time zone,
    revocada_por uuid
);

CREATE TABLE public.kb_article_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    article_id uuid NOT NULL,
    version integer NOT NULL,
    titulo text NOT NULL,
    contenido_md text NOT NULL,
    resumen text,
    modificado_por uuid,
    modificado_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.kb_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    titulo text NOT NULL,
    contenido_md text NOT NULL,
    resumen text,
    categoria public.cat_ticket,
    tipo_aplica public.tipo_ticket[] DEFAULT '{}'::public.tipo_ticket[] NOT NULL,
    audiencia public.audiencia_kb[] DEFAULT '{cliente,agente_l1,agente_l2_l3}'::public.audiencia_kb[] NOT NULL,
    tier_minimo public.tier_soporte DEFAULT 'l1'::public.tier_soporte NOT NULL,
    publicado boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    helpful_count integer DEFAULT 0 NOT NULL,
    not_helpful_count integer DEFAULT 0 NOT NULL,
    autor_id uuid,
    publicado_en timestamp with time zone,
    search_vector tsvector GENERATED ALWAYS AS (((setweight(to_tsvector('spanish'::regconfig, COALESCE(titulo, ''::text)), 'A'::"char") || setweight(to_tsvector('spanish'::regconfig, COALESCE(resumen, ''::text)), 'B'::"char")) || setweight(to_tsvector('spanish'::regconfig, COALESCE(contenido_md, ''::text)), 'C'::"char"))) STORED,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT kb_articles_helpful_count_check CHECK ((helpful_count >= 0)),
    CONSTRAINT kb_articles_not_helpful_count_check CHECK ((not_helpful_count >= 0)),
    CONSTRAINT kb_articles_version_check CHECK ((version >= 1)),
    CONSTRAINT kb_articles_view_count_check CHECK ((view_count >= 0))
);

CREATE TABLE public.kb_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    article_id uuid NOT NULL,
    viewer_user_id uuid,
    ticket_id uuid,
    session_id text,
    helpful boolean,
    deflected boolean,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.logs_auditoria (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,
    accion text NOT NULL,
    entidad text NOT NULL,
    entidad_id uuid,
    valor_anterior jsonb,
    valor_nuevo jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now(),
    caso_id uuid,
    ticket_id uuid
);

CREATE TABLE public.major_incident_updates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    major_incident_id uuid NOT NULL,
    contenido_md text NOT NULL,
    estado_en_momento public.estado_mim NOT NULL,
    publicado_por uuid NOT NULL,
    publicado_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.major_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    descripcion text NOT NULL,
    estado public.estado_mim DEFAULT 'declarado'::public.estado_mim NOT NULL,
    declarado_por uuid NOT NULL,
    declarado_at timestamp with time zone DEFAULT now() NOT NULL,
    mitigado_at timestamp with time zone,
    resuelto_at timestamp with time zone,
    pir_url text,
    servicios_afectados text[] DEFAULT '{}'::text[] NOT NULL,
    zonas_afectadas uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.mensajes_ticket (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    autor_id uuid NOT NULL,
    tipo_autor public.tipo_autor_msg NOT NULL,
    contenido text NOT NULL,
    adjunto_url text,
    created_at timestamp with time zone DEFAULT now(),
    es_interno boolean DEFAULT false NOT NULL,
    canned_response_id uuid
);

CREATE TABLE public.notificaciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    tipo public.tipo_notif NOT NULL,
    titulo text NOT NULL,
    cuerpo text,
    canal public.canal_notif DEFAULT 'sistema'::public.canal_notif,
    deeplink text,
    leida boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.push_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    token text NOT NULL,
    plataforma text DEFAULT 'web'::text NOT NULL,
    app text DEFAULT 'client'::text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT push_tokens_app_check CHECK ((app = ANY (ARRAY['client'::text, 'provider'::text]))),
    CONSTRAINT push_tokens_plataforma_check CHECK ((plataforma = ANY (ARRAY['ios'::text, 'android'::text, 'web'::text])))
);

CREATE TABLE public.ordenes_servicio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    prestador_id uuid,
    servicio_id uuid NOT NULL,
    direccion_id uuid NOT NULL,
    cupon_id uuid,
    estatus public.estatus_orden DEFAULT 'solicitada'::public.estatus_orden,
    fecha_programada timestamp with time zone NOT NULL,
    notas_cliente text,
    notas_prestador text,
    monto_total numeric(10,2) NOT NULL,
    descuento numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    pin_cliente character varying(6),
    pin_prestador character varying(6)
);

CREATE TABLE public.pagos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    orden_id uuid NOT NULL,
    monto numeric(10,2) NOT NULL,
    metodo public.metodo_pago NOT NULL,
    estatus public.estatus_pago DEFAULT 'pendiente'::public.estatus_pago,
    referencia_pasarela text,
    created_at timestamp with time zone DEFAULT now(),
    payment_intent_id text,
    customer_id_pasarela text,
    webhook_received_at timestamp with time zone,
    raw_status text
);

CREATE TABLE public.pagos_metodos_guardados (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    payment_method_id text NOT NULL,
    brand text,
    last4 text,
    exp_month smallint,
    exp_year smallint,
    predeterminado boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);

CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.permisos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clave text NOT NULL,
    descripcion text,
    modulo text NOT NULL
);

CREATE TABLE public.pins_soporte (
    admin_id uuid NOT NULL,
    pin_hash text NOT NULL,
    intentos_fallidos integer DEFAULT 0 NOT NULL,
    bloqueado_hasta timestamp with time zone,
    rotado_en timestamp with time zone DEFAULT now() NOT NULL,
    rotado_por uuid
);

CREATE TABLE public.pins_soporte_cliente (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    pin_hash text NOT NULL,
    generado_en timestamp with time zone DEFAULT now() NOT NULL,
    expira_en timestamp with time zone DEFAULT (now() + '00:15:00'::interval) NOT NULL,
    usado_por uuid,
    usado_en timestamp with time zone
);

CREATE TABLE public.reembolsos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pago_id uuid NOT NULL,
    ticket_id uuid,
    monto numeric(10,2) NOT NULL,
    motivo text NOT NULL,
    aprobado_por uuid,
    estatus public.estatus_reembolso DEFAULT 'solicitado'::public.estatus_reembolso,
    referencia_pasarela text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.roles_admin (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.roles_permisos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rol_id uuid NOT NULL,
    permiso_id uuid NOT NULL
);

CREATE TABLE public.servicios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    categoria_id uuid NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    precio_base numeric(10,2) NOT NULL,
    precio_maximo numeric(10,2),
    duracion_estimada_min integer,
    activo boolean DEFAULT true
);

CREATE TABLE public.servicios_prestador (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prestador_id uuid NOT NULL,
    servicio_id uuid NOT NULL,
    precio_custom numeric(10,2),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.sla_calendars (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    timezone text DEFAULT 'America/Mexico_City'::text NOT NULL,
    config_jsonb jsonb NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.sla_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    tipo public.tipo_ticket NOT NULL,
    prioridad public.prioridad_ticket NOT NULL,
    categoria public.cat_ticket,
    frt_minutos integer NOT NULL,
    ttr_minutos integer NOT NULL,
    business_hours_only boolean DEFAULT true NOT NULL,
    calendar_id uuid,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sla_policies_frt_minutos_check CHECK ((frt_minutos > 0)),
    CONSTRAINT sla_policies_ttr_minutos_check CHECK ((ttr_minutos > 0))
);

CREATE TABLE public.tarifas_zona (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    zona_id uuid NOT NULL,
    servicio_id uuid NOT NULL,
    tipo_ajuste public.tipo_ajuste NOT NULL,
    valor numeric(10,2) NOT NULL,
    vigencia_inicio date NOT NULL,
    vigencia_fin date,
    activa boolean DEFAULT true
);

CREATE TABLE public.ticket_major_incident_link (
    ticket_id uuid NOT NULL,
    major_incident_id uuid NOT NULL,
    vinculado_at timestamp with time zone DEFAULT now() NOT NULL,
    vinculado_por uuid NOT NULL
);

CREATE TABLE public.ticket_sla_state (
    ticket_id uuid NOT NULL,
    policy_id uuid NOT NULL,
    frt_due_at timestamp with time zone NOT NULL,
    ttr_due_at timestamp with time zone NOT NULL,
    primer_respuesta_at timestamp with time zone,
    resuelto_at timestamp with time zone,
    paused_since timestamp with time zone,
    paused_total_secs integer DEFAULT 0 NOT NULL,
    notified_50 boolean DEFAULT false NOT NULL,
    notified_80 boolean DEFAULT false NOT NULL,
    notified_100 boolean DEFAULT false NOT NULL,
    breached_frt boolean GENERATED ALWAYS AS (((primer_respuesta_at IS NOT NULL) AND (primer_respuesta_at > frt_due_at))) STORED,
    breached_ttr boolean GENERATED ALWAYS AS (((resuelto_at IS NOT NULL) AND (resuelto_at > ttr_due_at))) STORED,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ticket_sla_state_paused_total_secs_check CHECK ((paused_total_secs >= 0))
);

CREATE TABLE public.tickets_soporte (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    orden_id uuid,
    agente_id uuid,
    categoria public.cat_ticket NOT NULL,
    prioridad public.prioridad_ticket DEFAULT 'media'::public.prioridad_ticket,
    estatus public.estatus_ticket DEFAULT 'abierto'::public.estatus_ticket,
    asunto text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tipo public.tipo_ticket DEFAULT 'incidente'::public.tipo_ticket NOT NULL,
    tier_actual public.tier_soporte DEFAULT 'l1'::public.tier_soporte NOT NULL,
    grupo_asignado text NOT NULL,
    resolucion_codigo public.codigo_resolucion,
    resolucion_notas text,
    cerrado_at timestamp with time zone,
    cerrado_por uuid,
    problem_id uuid,
    workaround_md text,
    causa_raiz_md text,
    fix_permanente_md text,
    es_major_incident boolean DEFAULT false NOT NULL,
    CONSTRAINT chk_problem_fields_only_for_problem CHECK (((tipo = 'problema'::public.tipo_ticket) OR ((workaround_md IS NULL) AND (causa_raiz_md IS NULL) AND (fix_permanente_md IS NULL)))),
    CONSTRAINT chk_problem_no_self CHECK (((problem_id IS NULL) OR (problem_id <> id))),
    CONSTRAINT chk_resolucion_required_when_closed CHECK ((((estatus)::text <> ALL (ARRAY['cerrado'::text, 'resuelto'::text])) OR ((resolucion_codigo IS NOT NULL) AND (resolucion_notas IS NOT NULL) AND (length(resolucion_notas) >= 10))))
);

CREATE TABLE public.transacciones_prestador (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    orden_id uuid NOT NULL,
    prestador_id uuid NOT NULL,
    pago_id uuid NOT NULL,
    monto_prestador numeric(10,2) NOT NULL,
    comision_plataforma numeric(10,2) NOT NULL,
    estatus_deposito public.estatus_deposito DEFAULT 'pendiente'::public.estatus_deposito,
    referencia_bancaria text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.user_credentials (
    user_id uuid NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.usuarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    apellidos text NOT NULL,
    email text NOT NULL,
    telefono text,
    rol public.rol_usuario DEFAULT 'cliente'::public.rol_usuario NOT NULL,
    avatar_url text,
    activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    curp text,
    fecha_nacimiento date,
    agencia_id uuid,
    recibe_ordenes boolean DEFAULT true NOT NULL,
    motivo_restriccion text,
    restringido_en timestamp with time zone,
    restringido_por uuid,
    email_verificado_en timestamp with time zone,
    CONSTRAINT usuarios_curp_formato CHECK (((curp IS NULL) OR (curp ~ '^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9A-Z][0-9]$'::text)))
);

CREATE TABLE public.usuarios_admin (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    rol_id uuid NOT NULL,
    activo boolean DEFAULT true,
    ultimo_acceso timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proveedor text NOT NULL,
    external_id text NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    processed_at timestamp with time zone,
    error text,
    retry_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.zonas_cobertura (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    centro_lat numeric(10,7) NOT NULL,
    centro_lng numeric(10,7) NOT NULL,
    radio_km numeric(6,2),
    poligono_coords jsonb,
    estatus public.estatus_zona DEFAULT 'activa'::public.estatus_zona,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.accesos_perfil_usuario
    ADD CONSTRAINT accesos_perfil_usuario_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.agencias
    ADD CONSTRAINT agencias_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.banners_promocionales
    ADD CONSTRAINT banners_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.bancos_clabe
    ADD CONSTRAINT bancos_clabe_pkey PRIMARY KEY (codigo);

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_orden_id_calificador_id_key UNIQUE (orden_id, calificador_id);

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.canned_responses
    ADD CONSTRAINT canned_responses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.canned_responses
    ADD CONSTRAINT canned_responses_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.cargos_extra_orden
    ADD CONSTRAINT cargos_extra_orden_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.casos_soporte_abiertos
    ADD CONSTRAINT casos_soporte_abiertos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.categorias_servicio
    ADD CONSTRAINT categorias_servicio_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.comisiones_plataforma
    ADD CONSTRAINT comisiones_plataforma_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.config_sistema
    ADD CONSTRAINT config_sistema_clave_key UNIQUE (clave);

ALTER TABLE ONLY public.config_sistema
    ADD CONSTRAINT config_sistema_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cortes_pago
    ADD CONSTRAINT cortes_pago_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cuentas_bancarias_prestador
    ADD CONSTRAINT cuentas_bancarias_prestador_clabe_hash_key UNIQUE (clabe_hash);

ALTER TABLE ONLY public.cuentas_bancarias_prestador
    ADD CONSTRAINT cuentas_bancarias_prestador_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cuentas_bancarias_prestador
    ADD CONSTRAINT cuentas_bancarias_prestador_prestador_id_key UNIQUE (prestador_id);

ALTER TABLE ONLY public.csat_surveys
    ADD CONSTRAINT csat_surveys_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cupones
    ADD CONSTRAINT cupones_codigo_key UNIQUE (codigo);

ALTER TABLE ONLY public.cupones
    ADD CONSTRAINT cupones_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.direcciones
    ADD CONSTRAINT direcciones_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.disponibilidad_prestador
    ADD CONSTRAINT disponibilidad_prestador_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.documentos_prestador
    ADD CONSTRAINT documentos_prestador_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.email_verificaciones
    ADD CONSTRAINT email_verificaciones_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.escalation_log_ticket
    ADD CONSTRAINT escalation_log_ticket_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.evidencias_orden
    ADD CONSTRAINT evidencias_orden_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.facturas
    ADD CONSTRAINT facturas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.facturas
    ADD CONSTRAINT facturas_uuid_cfdi_key UNIQUE (uuid_cfdi);

ALTER TABLE ONLY public.historial_estatus_orden
    ADD CONSTRAINT historial_estatus_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.invitaciones_prestadores
    ADD CONSTRAINT invitaciones_prestadores_codigo_key UNIQUE (codigo);

ALTER TABLE ONLY public.invitaciones_prestadores
    ADD CONSTRAINT invitaciones_prestadores_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.kb_article_history
    ADD CONSTRAINT kb_article_history_article_id_version_key UNIQUE (article_id, version);

ALTER TABLE ONLY public.kb_article_history
    ADD CONSTRAINT kb_article_history_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.kb_articles
    ADD CONSTRAINT kb_articles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.kb_articles
    ADD CONSTRAINT kb_articles_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.kb_views
    ADD CONSTRAINT kb_views_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.logs_auditoria
    ADD CONSTRAINT logs_auditoria_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.major_incident_updates
    ADD CONSTRAINT major_incident_updates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.major_incidents
    ADD CONSTRAINT major_incidents_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.mensajes_ticket
    ADD CONSTRAINT mensajes_ticket_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ordenes_servicio
    ADD CONSTRAINT ordenes_servicio_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pagos_metodos_guardados
    ADD CONSTRAINT pagos_metodos_guardados_payment_method_id_key UNIQUE (payment_method_id);

ALTER TABLE ONLY public.pagos_metodos_guardados
    ADD CONSTRAINT pagos_metodos_guardados_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_clave_key UNIQUE (clave);

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_token_key UNIQUE (token);

ALTER TABLE ONLY public.pins_soporte_cliente
    ADD CONSTRAINT pins_soporte_cliente_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pins_soporte
    ADD CONSTRAINT pins_soporte_pkey PRIMARY KEY (admin_id);

ALTER TABLE ONLY public.reembolsos
    ADD CONSTRAINT reembolsos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.roles_admin
    ADD CONSTRAINT roles_admin_nombre_key UNIQUE (nombre);

ALTER TABLE ONLY public.roles_admin
    ADD CONSTRAINT roles_admin_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.roles_permisos
    ADD CONSTRAINT roles_permisos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.roles_permisos
    ADD CONSTRAINT roles_permisos_rol_id_permiso_id_key UNIQUE (rol_id, permiso_id);

ALTER TABLE ONLY public.servicios
    ADD CONSTRAINT servicios_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.servicios_prestador
    ADD CONSTRAINT servicios_prestador_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sla_calendars
    ADD CONSTRAINT sla_calendars_nombre_key UNIQUE (nombre);

ALTER TABLE ONLY public.sla_calendars
    ADD CONSTRAINT sla_calendars_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sla_policies
    ADD CONSTRAINT sla_policies_nombre_key UNIQUE (nombre);

ALTER TABLE ONLY public.sla_policies
    ADD CONSTRAINT sla_policies_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tarifas_zona
    ADD CONSTRAINT tarifas_zona_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ticket_major_incident_link
    ADD CONSTRAINT ticket_major_incident_link_pkey PRIMARY KEY (ticket_id, major_incident_id);

ALTER TABLE ONLY public.ticket_sla_state
    ADD CONSTRAINT ticket_sla_state_pkey PRIMARY KEY (ticket_id);

ALTER TABLE ONLY public.tickets_soporte
    ADD CONSTRAINT tickets_soporte_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.transacciones_prestador
    ADD CONSTRAINT transacciones_prestador_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.servicios_prestador
    ADD CONSTRAINT uq_servicio_prestador UNIQUE (prestador_id, servicio_id);

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT uq_webhook_event UNIQUE (proveedor, external_id);

ALTER TABLE ONLY public.user_credentials
    ADD CONSTRAINT user_credentials_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.usuarios_admin
    ADD CONSTRAINT usuarios_admin_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.usuarios_admin
    ADD CONSTRAINT usuarios_admin_usuario_id_key UNIQUE (usuario_id);

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_curp_unica UNIQUE (curp);

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.zonas_cobertura
    ADD CONSTRAINT zonas_cobertura_pkey PRIMARY KEY (id);

CREATE INDEX idx_accesos_admin_activo ON public.accesos_perfil_usuario USING btree (admin_id, expira_en) WHERE (revocado_en IS NULL);

CREATE INDEX idx_accesos_usuario ON public.accesos_perfil_usuario USING btree (usuario_id);

CREATE INDEX idx_calif_quien ON public.calificaciones USING btree (calificado_id);

CREATE INDEX idx_canned_categoria ON public.canned_responses USING btree (categoria, activo);

CREATE INDEX idx_canned_scope ON public.canned_responses USING btree (scope_grupo, activo);

CREATE INDEX idx_canned_tipo ON public.canned_responses USING gin (tipo_aplica);

CREATE INDEX idx_cargos_extra_orden ON public.cargos_extra_orden USING btree (orden_id);

CREATE INDEX idx_caso_ticket ON public.casos_soporte_abiertos USING btree (ticket_id) WHERE (ticket_id IS NOT NULL);

CREATE INDEX idx_casos_soporte_agente_activo ON public.casos_soporte_abiertos USING btree (agente_id, expira_en) WHERE (cerrado_en IS NULL);

CREATE INDEX idx_casos_soporte_cliente ON public.casos_soporte_abiertos USING btree (cliente_id);

CREATE INDEX idx_corte_prest ON public.cortes_pago USING btree (prestador_id);

CREATE INDEX idx_cuenta_bancaria_prestador_estatus ON public.cuentas_bancarias_prestador USING btree (estatus, updated_at DESC);

CREATE INDEX idx_csat_agente ON public.csat_surveys USING btree (agente_id, respondido_at DESC) WHERE (agente_id IS NOT NULL);

CREATE INDEX idx_csat_cliente ON public.csat_surveys USING btree (cliente_id, created_at DESC);

CREATE INDEX idx_csat_pending ON public.csat_surveys USING btree (estado, expira_at) WHERE (estado = ANY (ARRAY['pendiente'::public.estado_csat, 'enviado'::public.estado_csat]));

CREATE UNIQUE INDEX idx_csat_ticket ON public.csat_surveys USING btree (ticket_id);

CREATE INDEX idx_dir_user ON public.direcciones USING btree (usuario_id);

CREATE INDEX idx_disp_prest ON public.disponibilidad_prestador USING btree (prestador_id);

CREATE INDEX idx_docs_prest ON public.documentos_prestador USING btree (prestador_id);

CREATE INDEX idx_email_verif_usuario_activos ON public.email_verificaciones USING btree (usuario_id, expira_en) WHERE (usado_en IS NULL);

CREATE INDEX idx_escalation_ticket ON public.escalation_log_ticket USING btree (ticket_id, ocurrido_at DESC);

CREATE INDEX idx_evidencias_orden ON public.evidencias_orden USING btree (orden_id);

CREATE INDEX idx_evidencias_orden_fase ON public.evidencias_orden USING btree (orden_id, fase);

CREATE INDEX idx_facturas_estatus ON public.facturas USING btree (estatus, created_at DESC);

CREATE INDEX idx_facturas_pago ON public.facturas USING btree (pago_id) WHERE (pago_id IS NOT NULL);

CREATE INDEX idx_facturas_solicitada_por ON public.facturas USING btree (solicitada_por) WHERE (solicitada_por IS NOT NULL);

CREATE INDEX idx_hist_orden ON public.historial_estatus_orden USING btree (orden_id);

CREATE INDEX idx_invitaciones_codigo ON public.invitaciones_prestadores USING btree (codigo);

CREATE INDEX idx_invitaciones_disponibles ON public.invitaciones_prestadores USING btree (expira_en) WHERE (usado_en IS NULL);

CREATE INDEX idx_kb_audiencia ON public.kb_articles USING gin (audiencia);

CREATE INDEX idx_kb_history_article ON public.kb_article_history USING btree (article_id, version DESC);

CREATE INDEX idx_kb_published ON public.kb_articles USING btree (publicado, categoria) WHERE publicado;

CREATE INDEX idx_kb_search ON public.kb_articles USING gin (search_vector);

CREATE INDEX idx_kb_slug ON public.kb_articles USING btree (slug);

CREATE INDEX idx_kb_tipo_aplica ON public.kb_articles USING gin (tipo_aplica);

CREATE INDEX idx_kb_views_article ON public.kb_views USING btree (article_id, viewed_at DESC);

CREATE INDEX idx_kb_views_ticket ON public.kb_views USING btree (ticket_id) WHERE (ticket_id IS NOT NULL);

CREATE INDEX idx_log_admin ON public.logs_auditoria USING btree (admin_id);

CREATE INDEX idx_log_caso ON public.logs_auditoria USING btree (caso_id) WHERE (caso_id IS NOT NULL);

CREATE INDEX idx_log_fecha ON public.logs_auditoria USING btree (created_at DESC);

CREATE INDEX idx_log_ticket ON public.logs_auditoria USING btree (ticket_id) WHERE (ticket_id IS NOT NULL);

CREATE INDEX idx_mensajes_ticket_visible ON public.mensajes_ticket USING btree (ticket_id, es_interno, created_at);

CREATE INDEX idx_metodos_usuario ON public.pagos_metodos_guardados USING btree (usuario_id) WHERE (deleted_at IS NULL);

CREATE INDEX idx_mim_declarado_at ON public.major_incidents USING btree (declarado_at DESC);

CREATE INDEX idx_mim_estado_activos ON public.major_incidents USING btree (estado) WHERE (estado = ANY (ARRAY['declarado'::public.estado_mim, 'mitigando'::public.estado_mim, 'pir_pendiente'::public.estado_mim]));

CREATE INDEX idx_mim_update ON public.major_incident_updates USING btree (major_incident_id, publicado_at DESC);

CREATE INDEX idx_msg_tkt ON public.mensajes_ticket USING btree (ticket_id);

CREATE INDEX idx_notif_no_leidas ON public.notificaciones USING btree (usuario_id, leida) WHERE (leida = false);

CREATE INDEX idx_notif_user ON public.notificaciones USING btree (usuario_id);

CREATE INDEX idx_push_tokens_user_active ON public.push_tokens USING btree (usuario_id, app) WHERE (activo = true);

CREATE INDEX idx_ord_cliente ON public.ordenes_servicio USING btree (cliente_id);

CREATE INDEX idx_ord_estatus ON public.ordenes_servicio USING btree (estatus);

CREATE INDEX idx_ord_fecha ON public.ordenes_servicio USING btree (fecha_programada DESC);

CREATE INDEX idx_ord_prestador ON public.ordenes_servicio USING btree (prestador_id);

CREATE INDEX idx_pago_orden ON public.pagos USING btree (orden_id);

CREATE INDEX idx_pagos_customer_pasarela ON public.pagos USING btree (customer_id_pasarela) WHERE (customer_id_pasarela IS NOT NULL);

CREATE INDEX idx_pagos_estatus_created ON public.pagos USING btree (estatus, created_at DESC);

CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens USING btree (token);

CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);

CREATE INDEX idx_pins_soporte_cliente ON public.pins_soporte_cliente USING btree (cliente_id) WHERE (usado_en IS NULL);

CREATE INDEX idx_pins_soporte_vigentes ON public.pins_soporte_cliente USING btree (expira_en) WHERE (usado_en IS NULL);

CREATE INDEX idx_serv_cat ON public.servicios USING btree (categoria_id);

CREATE INDEX idx_serv_prest_activo ON public.servicios_prestador USING btree (activo) WHERE (activo = true);

CREATE INDEX idx_serv_prest_prestador ON public.servicios_prestador USING btree (prestador_id);

CREATE INDEX idx_serv_prest_servicio ON public.servicios_prestador USING btree (servicio_id);

CREATE INDEX idx_sla_policies_match ON public.sla_policies USING btree (tipo, prioridad, categoria, activo) WHERE (activo = true);

CREATE INDEX idx_sla_state_frt_pending ON public.ticket_sla_state USING btree (frt_due_at) WHERE (primer_respuesta_at IS NULL);

CREATE INDEX idx_sla_state_notify_pending ON public.ticket_sla_state USING btree (ttr_due_at) WHERE ((resuelto_at IS NULL) AND (notified_100 = false));

CREATE INDEX idx_sla_state_ttr_pending ON public.ticket_sla_state USING btree (ttr_due_at) WHERE (resuelto_at IS NULL);

CREATE INDEX idx_tickets_grupo_estatus ON public.tickets_soporte USING btree (grupo_asignado, estatus);

CREATE INDEX idx_tickets_major_incident ON public.tickets_soporte USING btree (es_major_incident) WHERE (es_major_incident = true);

CREATE INDEX idx_tickets_problem ON public.tickets_soporte USING btree (problem_id) WHERE (problem_id IS NOT NULL);

CREATE INDEX idx_tickets_tier_grupo ON public.tickets_soporte USING btree (tier_actual, grupo_asignado);

CREATE INDEX idx_tickets_tipo_estatus ON public.tickets_soporte USING btree (tipo, estatus);

CREATE INDEX idx_tkt_agente ON public.tickets_soporte USING btree (agente_id);

CREATE INDEX idx_tkt_status ON public.tickets_soporte USING btree (estatus);

CREATE INDEX idx_tkt_user ON public.tickets_soporte USING btree (usuario_id);

CREATE INDEX idx_tmim_mim ON public.ticket_major_incident_link USING btree (major_incident_id);

CREATE INDEX idx_trans_prest ON public.transacciones_prestador USING btree (prestador_id);

CREATE INDEX idx_usuarios_agencia ON public.usuarios USING btree (agencia_id);

CREATE INDEX idx_webhook_proveedor_type ON public.webhook_events USING btree (proveedor, event_type, created_at DESC);

CREATE INDEX idx_webhook_unprocessed ON public.webhook_events USING btree (created_at) WHERE (processed_at IS NULL);

CREATE UNIQUE INDEX uq_pagos_payment_intent ON public.pagos USING btree (payment_intent_id) WHERE (payment_intent_id IS NOT NULL);

CREATE TRIGGER asignar_prestador_auto_after_insert AFTER INSERT ON public.ordenes_servicio FOR EACH ROW EXECUTE FUNCTION public.trigger_asignar_prestador_auto();

CREATE TRIGGER generar_pines_orden_before_insert BEFORE INSERT ON public.ordenes_servicio FOR EACH ROW EXECUTE FUNCTION public.generar_pines_orden();

CREATE TRIGGER kb_articles_history_trigger BEFORE UPDATE ON public.kb_articles FOR EACH ROW EXECUTE FUNCTION public.trg_kb_articles_history();

CREATE TRIGGER mim_block_close_trigger BEFORE UPDATE ON public.major_incidents FOR EACH ROW EXECUTE FUNCTION public.trg_mim_block_close_if_open_tickets();

CREATE TRIGGER on_orden_update BEFORE UPDATE ON public.ordenes_servicio FOR EACH ROW EXECUTE FUNCTION public.trg_updated_at();

CREATE TRIGGER on_ticket_update BEFORE UPDATE ON public.tickets_soporte FOR EACH ROW EXECUTE FUNCTION public.trg_updated_at();

CREATE TRIGGER on_usuario_update BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.trg_updated_at();

CREATE TRIGGER sla_first_response_trigger AFTER INSERT ON public.mensajes_ticket FOR EACH ROW EXECUTE FUNCTION public.trg_sla_mark_first_response();

CREATE TRIGGER sla_resolve_trigger AFTER UPDATE OF estatus ON public.tickets_soporte FOR EACH ROW EXECUTE FUNCTION public.trg_sla_mark_resolved();

CREATE TRIGGER tickets_auto_assign_grupo_trigger BEFORE INSERT ON public.tickets_soporte FOR EACH ROW EXECUTE FUNCTION public.trg_tickets_auto_assign_grupo();

CREATE TRIGGER tickets_bootstrap_sla_trigger AFTER INSERT ON public.tickets_soporte FOR EACH ROW EXECUTE FUNCTION public.trg_tickets_bootstrap_sla();

CREATE TRIGGER touch_canned BEFORE UPDATE ON public.canned_responses FOR EACH ROW EXECUTE FUNCTION public.trg_touch_updated_at();

CREATE TRIGGER touch_mim BEFORE UPDATE ON public.major_incidents FOR EACH ROW EXECUTE FUNCTION public.trg_touch_updated_at();

CREATE TRIGGER touch_sla_calendars BEFORE UPDATE ON public.sla_calendars FOR EACH ROW EXECUTE FUNCTION public.trg_touch_updated_at();

CREATE TRIGGER touch_sla_policies BEFORE UPDATE ON public.sla_policies FOR EACH ROW EXECUTE FUNCTION public.trg_touch_updated_at();

CREATE TRIGGER touch_sla_state BEFORE UPDATE ON public.ticket_sla_state FOR EACH ROW EXECUTE FUNCTION public.trg_touch_updated_at();

ALTER TABLE ONLY public.accesos_perfil_usuario
    ADD CONSTRAINT accesos_perfil_usuario_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.usuarios(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.accesos_perfil_usuario
    ADD CONSTRAINT accesos_perfil_usuario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.banners_promocionales
    ADD CONSTRAINT banners_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_calificado_id_fkey FOREIGN KEY (calificado_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_calificador_id_fkey FOREIGN KEY (calificador_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES public.ordenes_servicio(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cargos_extra_orden
    ADD CONSTRAINT cargos_extra_orden_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES public.ordenes_servicio(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cargos_extra_orden
    ADD CONSTRAINT cargos_extra_orden_propuesto_por_fkey FOREIGN KEY (propuesto_por) REFERENCES public.usuarios(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.cargos_extra_orden
    ADD CONSTRAINT cargos_extra_orden_resuelto_por_fkey FOREIGN KEY (resuelto_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.casos_soporte_abiertos
    ADD CONSTRAINT casos_soporte_abiertos_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.usuarios(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.casos_soporte_abiertos
    ADD CONSTRAINT casos_soporte_abiertos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.usuarios(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.casos_soporte_abiertos
    ADD CONSTRAINT casos_soporte_abiertos_pin_id_fkey FOREIGN KEY (pin_id) REFERENCES public.pins_soporte_cliente(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.casos_soporte_abiertos
    ADD CONSTRAINT casos_soporte_abiertos_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets_soporte(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.comisiones_plataforma
    ADD CONSTRAINT comisiones_plataforma_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias_servicio(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.config_sistema
    ADD CONSTRAINT config_sistema_modificado_por_fkey FOREIGN KEY (modificado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.cortes_pago
    ADD CONSTRAINT cortes_pago_aprobado_por_fkey FOREIGN KEY (aprobado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.cortes_pago
    ADD CONSTRAINT cortes_pago_prestador_id_fkey FOREIGN KEY (prestador_id) REFERENCES public.usuarios(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.cuentas_bancarias_prestador
    ADD CONSTRAINT cuentas_bancarias_prestador_banco_codigo_fkey FOREIGN KEY (banco_codigo) REFERENCES public.bancos_clabe(codigo) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.cuentas_bancarias_prestador
    ADD CONSTRAINT cuentas_bancarias_prestador_prestador_id_fkey FOREIGN KEY (prestador_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cuentas_bancarias_prestador
    ADD CONSTRAINT cuentas_bancarias_prestador_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.csat_surveys
    ADD CONSTRAINT csat_surveys_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.csat_surveys
    ADD CONSTRAINT csat_surveys_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.csat_surveys
    ADD CONSTRAINT csat_surveys_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets_soporte(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cupones
    ADD CONSTRAINT cupones_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias_servicio(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.direcciones
    ADD CONSTRAINT direcciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.disponibilidad_prestador
    ADD CONSTRAINT disponibilidad_prestador_prestador_id_fkey FOREIGN KEY (prestador_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.documentos_prestador
    ADD CONSTRAINT documentos_prestador_prestador_id_fkey FOREIGN KEY (prestador_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.email_verificaciones
    ADD CONSTRAINT email_verificaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.escalation_log_ticket
    ADD CONSTRAINT escalation_log_ticket_from_user_fkey FOREIGN KEY (from_user) REFERENCES public.usuarios(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.escalation_log_ticket
    ADD CONSTRAINT escalation_log_ticket_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets_soporte(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.escalation_log_ticket
    ADD CONSTRAINT escalation_log_ticket_to_user_fkey FOREIGN KEY (to_user) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.evidencias_orden
    ADD CONSTRAINT evidencias_orden_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES public.ordenes_servicio(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.evidencias_orden
    ADD CONSTRAINT evidencias_orden_subida_por_fkey FOREIGN KEY (subida_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.facturas
    ADD CONSTRAINT facturas_corte_id_fkey FOREIGN KEY (corte_id) REFERENCES public.cortes_pago(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.facturas
    ADD CONSTRAINT facturas_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES public.ordenes_servicio(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.facturas
    ADD CONSTRAINT facturas_pago_id_fkey FOREIGN KEY (pago_id) REFERENCES public.pagos(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.facturas
    ADD CONSTRAINT facturas_solicitada_por_fkey FOREIGN KEY (solicitada_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.mensajes_ticket
    ADD CONSTRAINT fk_msg_canned FOREIGN KEY (canned_response_id) REFERENCES public.canned_responses(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.historial_estatus_orden
    ADD CONSTRAINT historial_estatus_cambiado_por_fkey FOREIGN KEY (cambiado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.historial_estatus_orden
    ADD CONSTRAINT historial_estatus_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES public.ordenes_servicio(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.invitaciones_prestadores
    ADD CONSTRAINT invitaciones_prestadores_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.invitaciones_prestadores
    ADD CONSTRAINT invitaciones_prestadores_revocada_por_fkey FOREIGN KEY (revocada_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.kb_article_history
    ADD CONSTRAINT kb_article_history_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.kb_articles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.kb_article_history
    ADD CONSTRAINT kb_article_history_modificado_por_fkey FOREIGN KEY (modificado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.kb_articles
    ADD CONSTRAINT kb_articles_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.kb_views
    ADD CONSTRAINT kb_views_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.kb_articles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.kb_views
    ADD CONSTRAINT kb_views_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets_soporte(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.kb_views
    ADD CONSTRAINT kb_views_viewer_user_id_fkey FOREIGN KEY (viewer_user_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.logs_auditoria
    ADD CONSTRAINT logs_auditoria_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.usuarios(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.logs_auditoria
    ADD CONSTRAINT logs_auditoria_caso_id_fkey FOREIGN KEY (caso_id) REFERENCES public.casos_soporte_abiertos(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.logs_auditoria
    ADD CONSTRAINT logs_auditoria_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets_soporte(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.major_incident_updates
    ADD CONSTRAINT major_incident_updates_major_incident_id_fkey FOREIGN KEY (major_incident_id) REFERENCES public.major_incidents(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.major_incident_updates
    ADD CONSTRAINT major_incident_updates_publicado_por_fkey FOREIGN KEY (publicado_por) REFERENCES public.usuarios(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.major_incidents
    ADD CONSTRAINT major_incidents_declarado_por_fkey FOREIGN KEY (declarado_por) REFERENCES public.usuarios(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.mensajes_ticket
    ADD CONSTRAINT mensajes_ticket_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.mensajes_ticket
    ADD CONSTRAINT mensajes_ticket_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets_soporte(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ordenes_servicio
    ADD CONSTRAINT ordenes_servicio_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.usuarios(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.ordenes_servicio
    ADD CONSTRAINT ordenes_servicio_cupon_id_fkey FOREIGN KEY (cupon_id) REFERENCES public.cupones(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ordenes_servicio
    ADD CONSTRAINT ordenes_servicio_direccion_id_fkey FOREIGN KEY (direccion_id) REFERENCES public.direcciones(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.ordenes_servicio
    ADD CONSTRAINT ordenes_servicio_prestador_id_fkey FOREIGN KEY (prestador_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ordenes_servicio
    ADD CONSTRAINT ordenes_servicio_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.pagos_metodos_guardados
    ADD CONSTRAINT pagos_metodos_guardados_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES public.ordenes_servicio(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pins_soporte
    ADD CONSTRAINT pins_soporte_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pins_soporte_cliente
    ADD CONSTRAINT pins_soporte_cliente_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pins_soporte_cliente
    ADD CONSTRAINT pins_soporte_cliente_usado_por_fkey FOREIGN KEY (usado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.pins_soporte
    ADD CONSTRAINT pins_soporte_rotado_por_fkey FOREIGN KEY (rotado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.reembolsos
    ADD CONSTRAINT reembolsos_aprobado_por_fkey FOREIGN KEY (aprobado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.reembolsos
    ADD CONSTRAINT reembolsos_pago_id_fkey FOREIGN KEY (pago_id) REFERENCES public.pagos(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.reembolsos
    ADD CONSTRAINT reembolsos_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets_soporte(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.roles_permisos
    ADD CONSTRAINT roles_permisos_permiso_id_fkey FOREIGN KEY (permiso_id) REFERENCES public.permisos(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.roles_permisos
    ADD CONSTRAINT roles_permisos_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles_admin(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.servicios
    ADD CONSTRAINT servicios_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias_servicio(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.servicios_prestador
    ADD CONSTRAINT servicios_prestador_prestador_id_fkey FOREIGN KEY (prestador_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.servicios_prestador
    ADD CONSTRAINT servicios_prestador_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sla_policies
    ADD CONSTRAINT sla_policies_calendar_id_fkey FOREIGN KEY (calendar_id) REFERENCES public.sla_calendars(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.tarifas_zona
    ADD CONSTRAINT tarifas_zona_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tarifas_zona
    ADD CONSTRAINT tarifas_zona_zona_id_fkey FOREIGN KEY (zona_id) REFERENCES public.zonas_cobertura(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ticket_major_incident_link
    ADD CONSTRAINT ticket_major_incident_link_major_incident_id_fkey FOREIGN KEY (major_incident_id) REFERENCES public.major_incidents(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ticket_major_incident_link
    ADD CONSTRAINT ticket_major_incident_link_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets_soporte(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ticket_major_incident_link
    ADD CONSTRAINT ticket_major_incident_link_vinculado_por_fkey FOREIGN KEY (vinculado_por) REFERENCES public.usuarios(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.ticket_sla_state
    ADD CONSTRAINT ticket_sla_state_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.sla_policies(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.ticket_sla_state
    ADD CONSTRAINT ticket_sla_state_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets_soporte(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tickets_soporte
    ADD CONSTRAINT tickets_soporte_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.tickets_soporte
    ADD CONSTRAINT tickets_soporte_cerrado_por_fkey FOREIGN KEY (cerrado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.tickets_soporte
    ADD CONSTRAINT tickets_soporte_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES public.ordenes_servicio(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.tickets_soporte
    ADD CONSTRAINT tickets_soporte_problem_id_fkey FOREIGN KEY (problem_id) REFERENCES public.tickets_soporte(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.tickets_soporte
    ADD CONSTRAINT tickets_soporte_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.transacciones_prestador
    ADD CONSTRAINT transacciones_prestador_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES public.ordenes_servicio(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.transacciones_prestador
    ADD CONSTRAINT transacciones_prestador_pago_id_fkey FOREIGN KEY (pago_id) REFERENCES public.pagos(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.transacciones_prestador
    ADD CONSTRAINT transacciones_prestador_prestador_id_fkey FOREIGN KEY (prestador_id) REFERENCES public.usuarios(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.user_credentials
    ADD CONSTRAINT user_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.usuarios_admin
    ADD CONSTRAINT usuarios_admin_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles_admin(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.usuarios_admin
    ADD CONSTRAINT usuarios_admin_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_agencia_id_fkey FOREIGN KEY (agencia_id) REFERENCES public.agencias(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_restringido_por_fkey FOREIGN KEY (restringido_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.accesos_perfil_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_crea_banner ON public.banners_promocionales FOR INSERT TO authenticated WITH CHECK (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_crea_cat ON public.categorias_servicio FOR INSERT TO authenticated WITH CHECK (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_crea_serv ON public.servicios FOR INSERT TO authenticated WITH CHECK (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_cupones ON public.cupones FOR INSERT TO authenticated WITH CHECK (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_edita_cat ON public.categorias_servicio FOR UPDATE TO authenticated USING (( SELECT public.es_admin() AS es_admin)) WITH CHECK (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_edita_config ON public.config_sistema FOR UPDATE TO authenticated USING (( SELECT public.es_admin() AS es_admin)) WITH CHECK (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_edita_orden ON public.ordenes_servicio FOR UPDATE TO authenticated USING (( SELECT public.es_admin() AS es_admin)) WITH CHECK (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_edita_serv ON public.servicios FOR UPDATE TO authenticated USING (( SELECT public.es_admin() AS es_admin)) WITH CHECK (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_lee_msgs ON public.mensajes_ticket FOR SELECT TO authenticated USING (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_revisa_doc ON public.documentos_prestador FOR UPDATE TO authenticated USING (( SELECT public.es_admin() AS es_admin)) WITH CHECK (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_ve_admins ON public.usuarios_admin FOR SELECT TO authenticated USING (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_ve_comisiones ON public.comisiones_plataforma FOR SELECT TO authenticated USING (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_ve_config ON public.config_sistema FOR SELECT TO authenticated USING (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_ve_cortes ON public.cortes_pago FOR SELECT TO authenticated USING (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_actualiza_cuentas_bancarias_prestador ON public.cuentas_bancarias_prestador FOR UPDATE TO authenticated USING (( SELECT public.es_admin() AS es_admin)) WITH CHECK (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_crea_cuentas_bancarias_prestador ON public.cuentas_bancarias_prestador FOR INSERT TO authenticated WITH CHECK (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_gestiona_bancos_clabe ON public.bancos_clabe TO authenticated USING (( SELECT public.es_admin() AS es_admin)) WITH CHECK (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_ve_cuentas_bancarias_prestador ON public.cuentas_bancarias_prestador FOR SELECT TO authenticated USING (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_ve_docs ON public.documentos_prestador FOR SELECT TO authenticated USING (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_ve_facturas ON public.facturas FOR SELECT TO authenticated USING (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_ve_historial ON public.historial_estatus_orden FOR SELECT TO authenticated USING (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_ve_logs ON public.logs_auditoria FOR SELECT TO authenticated USING (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_ve_ordenes ON public.ordenes_servicio FOR SELECT TO authenticated USING (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_ve_pagos ON public.pagos FOR SELECT TO authenticated USING (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_ve_permisos ON public.permisos FOR SELECT TO authenticated USING (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_ve_reembolsos ON public.reembolsos FOR SELECT TO authenticated USING (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_ve_roles ON public.roles_admin FOR SELECT TO authenticated USING (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_ve_rp ON public.roles_permisos FOR SELECT TO authenticated USING (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_ve_tarifas ON public.tarifas_zona FOR SELECT TO authenticated USING (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_ve_tickets ON public.tickets_soporte FOR SELECT TO authenticated USING (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_ve_trans ON public.transacciones_prestador FOR SELECT TO authenticated USING (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_ve_usuarios ON public.usuarios FOR SELECT TO authenticated USING (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_ve_webhook_events ON public.webhook_events FOR SELECT TO authenticated USING (( SELECT public.es_admin() AS es_admin));

CREATE POLICY admin_zona ON public.zonas_cobertura FOR INSERT TO authenticated WITH CHECK (( SELECT public.es_admin() AS es_admin));

CREATE POLICY authenticated_ve_bancos_clabe ON public.bancos_clabe FOR SELECT TO authenticated USING ((activo = true));

ALTER TABLE public.agencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY agencias_manage_admin ON public.agencias TO authenticated USING (( SELECT public.es_admin() AS es_admin)) WITH CHECK (( SELECT public.es_admin() AS es_admin));

CREATE POLICY agencias_select_auth ON public.agencias FOR SELECT TO authenticated USING (true);

ALTER TABLE public.banners_promocionales ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.bancos_clabe ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.calificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY canned_mutate ON public.canned_responses USING (true) WITH CHECK (true);

ALTER TABLE public.canned_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY canned_select ON public.canned_responses FOR SELECT USING (true);

ALTER TABLE public.cargos_extra_orden ENABLE ROW LEVEL SECURITY;

CREATE POLICY cargos_extra_select_admin ON public.cargos_extra_orden FOR SELECT TO authenticated USING (( SELECT public.es_admin() AS es_admin));

ALTER TABLE public.casos_soporte_abiertos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.categorias_servicio ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.comisiones_plataforma ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.config_sistema ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cortes_pago ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cuentas_bancarias_prestador ENABLE ROW LEVEL SECURITY;

CREATE POLICY prestador_ve_su_cuenta_bancaria ON public.cuentas_bancarias_prestador FOR SELECT TO authenticated USING ((prestador_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY csat_insert ON public.csat_surveys FOR INSERT WITH CHECK (true);

CREATE POLICY csat_select ON public.csat_surveys FOR SELECT USING (true);

ALTER TABLE public.csat_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY csat_update_cliente ON public.csat_surveys FOR UPDATE USING (true) WITH CHECK (true);

ALTER TABLE public.cupones ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.direcciones ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.disponibilidad_prestador ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.documentos_prestador ENABLE ROW LEVEL SECURITY;

CREATE POLICY escalation_insert ON public.escalation_log_ticket FOR INSERT WITH CHECK (true);

ALTER TABLE public.escalation_log_ticket ENABLE ROW LEVEL SECURITY;

CREATE POLICY escalation_select ON public.escalation_log_ticket FOR SELECT USING (true);

CREATE POLICY evidencias_delete_admin ON public.evidencias_orden FOR DELETE TO authenticated USING (( SELECT public.es_admin() AS es_admin));

ALTER TABLE public.evidencias_orden ENABLE ROW LEVEL SECURITY;

CREATE POLICY evidencias_select_admin ON public.evidencias_orden FOR SELECT TO authenticated USING (( SELECT public.es_admin() AS es_admin));

ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.historial_estatus_orden ENABLE ROW LEVEL SECURITY;

CREATE POLICY invitaciones_admin_all ON public.invitaciones_prestadores TO authenticated USING (( SELECT public.es_admin() AS es_admin)) WITH CHECK (( SELECT public.es_admin() AS es_admin));

ALTER TABLE public.invitaciones_prestadores ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.kb_article_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY kb_hist_select ON public.kb_article_history FOR SELECT USING (true);

CREATE POLICY kb_mutate ON public.kb_articles USING (true) WITH CHECK (true);

CREATE POLICY kb_select ON public.kb_articles FOR SELECT USING (true);

ALTER TABLE public.kb_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY kb_views_insert ON public.kb_views FOR INSERT WITH CHECK (true);

CREATE POLICY kb_views_select ON public.kb_views FOR SELECT USING (true);

CREATE POLICY leer_califs ON public.calificaciones FOR SELECT TO authenticated USING (true);

CREATE POLICY leer_categorias ON public.categorias_servicio FOR SELECT TO authenticated USING (true);

CREATE POLICY leer_disp ON public.disponibilidad_prestador FOR SELECT TO authenticated USING (true);

CREATE POLICY leer_servicios ON public.servicios FOR SELECT TO authenticated USING (true);

ALTER TABLE public.logs_auditoria ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.major_incident_updates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.major_incidents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.mensajes_ticket ENABLE ROW LEVEL SECURITY;

CREATE POLICY mim_mutate ON public.major_incidents USING (true) WITH CHECK (true);

CREATE POLICY mim_select ON public.major_incidents FOR SELECT USING (true);

CREATE POLICY mim_upd_insert ON public.major_incident_updates FOR INSERT WITH CHECK (true);

CREATE POLICY mim_upd_select ON public.major_incident_updates FOR SELECT USING (true);

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ordenes_servicio ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pagos_metodos_guardados ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.permisos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pins_soporte ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pins_soporte_cliente ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.reembolsos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.roles_admin ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.roles_permisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY serv_prest_select_all ON public.servicios_prestador FOR SELECT TO authenticated USING (true);

ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.servicios_prestador ENABLE ROW LEVEL SECURITY;

CREATE POLICY sla_cal_mutate ON public.sla_calendars USING (true) WITH CHECK (true);

CREATE POLICY sla_cal_select ON public.sla_calendars FOR SELECT USING (true);

ALTER TABLE public.sla_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY sla_pol_mutate ON public.sla_policies USING (true) WITH CHECK (true);

CREATE POLICY sla_pol_select ON public.sla_policies FOR SELECT USING (true);

ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY sla_state_mutate ON public.ticket_sla_state USING (true) WITH CHECK (true);

CREATE POLICY sla_state_select ON public.ticket_sla_state FOR SELECT USING (true);

ALTER TABLE public.tarifas_zona ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ticket_major_incident_link ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ticket_sla_state ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tickets_soporte ENABLE ROW LEVEL SECURITY;

CREATE POLICY tmim_mutate ON public.ticket_major_incident_link USING (true) WITH CHECK (true);

CREATE POLICY tmim_select ON public.ticket_major_incident_link FOR SELECT USING (true);

ALTER TABLE public.transacciones_prestador ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.usuarios_admin ENABLE ROW LEVEL SECURITY;

CREATE POLICY usuarios_select_admin_scoped ON public.usuarios FOR SELECT TO authenticated USING ((public.tiene_permiso('usuarios.listar_completo'::text) OR public.tiene_acceso_perfil(id)));

CREATE POLICY ver_banners ON public.banners_promocionales FOR SELECT TO authenticated USING (true);

CREATE POLICY ver_cupones ON public.cupones FOR SELECT TO authenticated USING (true);

CREATE POLICY ver_mis_metodos ON public.pagos_metodos_guardados FOR SELECT TO authenticated USING (((usuario_id = ( SELECT auth.uid() AS uid)) AND (deleted_at IS NULL)));

CREATE POLICY ver_zonas ON public.zonas_cobertura FOR SELECT TO authenticated USING (true);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.zonas_cobertura ENABLE ROW LEVEL SECURITY;
