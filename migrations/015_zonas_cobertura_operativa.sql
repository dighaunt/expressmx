

BEGIN;

CREATE OR REPLACE FUNCTION public.distancia_km(
  p_lat1 numeric,
  p_lng1 numeric,
  p_lat2 numeric,
  p_lng2 numeric
) RETURNS numeric
LANGUAGE sql
IMMUTABLE
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

CREATE OR REPLACE FUNCTION public.zona_poligono_contiene(
  p_lat numeric,
  p_lng numeric,
  p_poligono jsonb
) RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
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

CREATE OR REPLACE FUNCTION public.zona_cobertura_resuelve_punto(
  p_lat numeric,
  p_lng numeric
) RETURNS TABLE(
  id uuid,
  nombre text,
  estatus public.estatus_zona,
  distancia_km numeric,
  radio_km numeric,
  match_tipo text
)
LANGUAGE sql
STABLE
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

CREATE OR REPLACE FUNCTION public.zona_operativa_para_punto(
  p_lat numeric,
  p_lng numeric,
  p_servicio_id uuid DEFAULT NULL,
  p_fecha date DEFAULT CURRENT_DATE
) RETURNS TABLE(
  zona_id uuid,
  zona_nombre text,
  distancia_km numeric,
  tarifa_id uuid,
  tipo_ajuste public.tipo_ajuste,
  valor numeric
)
LANGUAGE sql
STABLE
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

CREATE OR REPLACE FUNCTION public.validar_prestador_para_orden(p_orden_id uuid, p_prestador_id uuid) RETURNS TABLE(elegible boolean, motivo text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_servicio_id uuid;
  v_inicio timestamptz;
  v_fin timestamptz;
  v_lat numeric;
  v_lng numeric;
  v_inicio_local timestamp;
  v_fin_local timestamp;
  v_dia dia_semana;
  v_hora_inicio time;
  v_hora_fin time;
  v_prestador record;
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
    RETURN QUERY SELECT false, 'Orden no encontrada';
    RETURN;
  END IF;

  IF v_lat IS NULL OR v_lng IS NULL THEN
    RETURN QUERY SELECT false, 'La dirección de la orden no tiene coordenadas verificables';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.zona_operativa_para_punto(v_lat, v_lng, v_servicio_id, v_inicio::date)
  ) THEN
    RETURN QUERY SELECT false, 'La dirección está fuera de una zona operativa activa';
    RETURN;
  END IF;

  SELECT rol::text AS rol, activo, recibe_ordenes, restringido_en
  INTO v_prestador
  FROM public.usuarios
  WHERE id = p_prestador_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Prestador no encontrado';
    RETURN;
  END IF;

  IF v_prestador.rol != 'prestador' THEN
    RETURN QUERY SELECT false, 'Esa cuenta no es de prestador';
    RETURN;
  END IF;

  IF v_prestador.activo IS NOT TRUE OR v_prestador.recibe_ordenes IS NOT TRUE OR v_prestador.restringido_en IS NOT NULL THEN
    RETURN QUERY SELECT false, 'El prestador está inactivo, restringido o no acepta órdenes nuevas';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.servicios_prestador sp
    WHERE sp.prestador_id = p_prestador_id
      AND sp.servicio_id = v_servicio_id
      AND sp.activo = true
  ) THEN
    RETURN QUERY SELECT false, 'El prestador no ofrece este servicio';
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
           dp.zona_lat IS NULL
           OR dp.zona_lng IS NULL
           OR public.distancia_km(v_lat, v_lng, dp.zona_lat, dp.zona_lng) <= COALESCE(dp.radio_cobertura_km, 10)
         )
     ) THEN
    RETURN QUERY SELECT false, 'El prestador no tiene disponibilidad para el horario o zona';
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
    RETURN QUERY SELECT false, 'El prestador ya tiene una orden traslapada';
    RETURN;
  END IF;

  RETURN QUERY SELECT true, null::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.aplicar_cobertura_orden()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lat numeric;
  v_lng numeric;
  v_precio_base numeric(10,2);
  v_zona record;
BEGIN
  SELECT d.latitud, d.longitud
  INTO v_lat, v_lng
  FROM public.direcciones d
  WHERE d.id = NEW.direccion_id
    AND d.usuario_id = NEW.cliente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La dirección no pertenece al cliente de la orden'
      USING ERRCODE = '23514';
  END IF;

  IF v_lat IS NULL OR v_lng IS NULL THEN
    RAISE EXCEPTION 'La dirección no tiene coordenadas verificables'
      USING ERRCODE = '23514';
  END IF;

  SELECT s.precio_base
  INTO v_precio_base
  FROM public.servicios s
  WHERE s.id = NEW.servicio_id
    AND s.activo IS TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Servicio no encontrado o inactivo'
      USING ERRCODE = '23514';
  END IF;

  SELECT *
  INTO v_zona
  FROM public.zona_operativa_para_punto(v_lat, v_lng, NEW.servicio_id, NEW.fecha_programada::date);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La dirección está fuera de una zona operativa activa'
      USING ERRCODE = '23514';
  END IF;

  NEW.monto_total := ROUND(
    CASE
      WHEN v_zona.tipo_ajuste = 'multiplicador' THEN v_precio_base * v_zona.valor
      WHEN v_zona.tipo_ajuste = 'monto_fijo' THEN v_precio_base + v_zona.valor
      ELSE v_precio_base
    END,
    2
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aplicar_cobertura_orden_before_insert ON public.ordenes_servicio;
CREATE TRIGGER aplicar_cobertura_orden_before_insert
BEFORE INSERT ON public.ordenes_servicio
FOR EACH ROW
EXECUTE FUNCTION public.aplicar_cobertura_orden();

COMMIT;
