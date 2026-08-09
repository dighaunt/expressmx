CREATE TABLE IF NOT EXISTS public.bancos_clabe (
  codigo text PRIMARY KEY,
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT TRUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bancos_clabe_codigo_check CHECK (codigo ~ '^[0-9]{3}$'),
  CONSTRAINT bancos_clabe_nombre_check CHECK (length(btrim(nombre)) >= 2)
);

INSERT INTO public.bancos_clabe (codigo, nombre, activo)
VALUES
  ('002', 'BANAMEX', TRUE),
  ('006', 'BANCOMEXT', TRUE),
  ('009', 'BANOBRAS', TRUE),
  ('012', 'BBVA MEXICO', TRUE),
  ('014', 'SANTANDER', TRUE),
  ('019', 'BANJERCITO', TRUE),
  ('021', 'HSBC', TRUE),
  ('030', 'BAJIO', TRUE),
  ('036', 'INBURSA', TRUE),
  ('042', 'MIFEL', TRUE),
  ('044', 'SCOTIABANK', TRUE),
  ('058', 'BANREGIO', TRUE),
  ('059', 'INVEX', TRUE),
  ('060', 'BANSI', TRUE),
  ('062', 'AFIRME', TRUE),
  ('072', 'BANORTE', TRUE),
  ('106', 'BANK OF AMERICA', TRUE),
  ('108', 'MUFG', TRUE),
  ('110', 'JP MORGAN', TRUE),
  ('112', 'BMONEX', TRUE),
  ('113', 'VE POR MAS', TRUE),
  ('126', 'CREDIT SUISSE', TRUE),
  ('127', 'AZTECA', TRUE),
  ('128', 'AUTOFIN', TRUE),
  ('129', 'BARCLAYS', TRUE),
  ('130', 'COMPARTAMOS', TRUE),
  ('132', 'MULTIVA BANCO', TRUE),
  ('133', 'ACTINVER', TRUE),
  ('136', 'INTERCAM BANCO', TRUE),
  ('137', 'BANCOPPEL', TRUE),
  ('138', 'ABC CAPITAL', TRUE),
  ('140', 'CONSUBANCO', TRUE),
  ('143', 'CIBANCO', TRUE),
  ('145', 'BBASE', TRUE),
  ('147', 'BANKAOOL', TRUE),
  ('148', 'PAGATODO', TRUE),
  ('150', 'INMOBILIARIO', TRUE),
  ('151', 'DONDE', TRUE),
  ('152', 'BANCREA', TRUE),
  ('154', 'BANCO COVALTO', TRUE),
  ('155', 'ICBC', TRUE),
  ('156', 'SABADELL', TRUE),
  ('157', 'SHINHAN', TRUE),
  ('158', 'MIZUHO BANK', TRUE),
  ('159', 'BANK OF CHINA', TRUE),
  ('160', 'BANCO S3', TRUE),
  ('166', 'BANCO DEL BIENESTAR', TRUE),
  ('168', 'HIPOTECARIA FEDERAL', TRUE),
  ('600', 'MONEXCB', TRUE),
  ('601', 'GBM', TRUE),
  ('602', 'MASARI', TRUE),
  ('605', 'VALUE', TRUE),
  ('606', 'ESTRUCTURADORES', TRUE),
  ('607', 'TIBER', TRUE),
  ('608', 'VECTOR', TRUE),
  ('610', 'B AND B', TRUE),
  ('613', 'MULTIVA CBOLSA', TRUE),
  ('614', 'ACCIVAL', TRUE),
  ('615', 'MERRILL LYNCH', TRUE),
  ('616', 'FINAMEX', TRUE),
  ('617', 'VALMEX', TRUE),
  ('618', 'UNICA', TRUE),
  ('619', 'MAPFRE', TRUE),
  ('620', 'PROFUTURO', TRUE),
  ('621', 'CB ACTINVER', TRUE),
  ('622', 'OACTIN', TRUE),
  ('623', 'SKANDIA', TRUE),
  ('626', 'CBDEUTSCHE', TRUE),
  ('627', 'ZURICH', TRUE),
  ('628', 'ZURICHVI', TRUE),
  ('629', 'SU CASITA', TRUE),
  ('630', 'CB INTERCAM', TRUE),
  ('631', 'CI BOLSA', TRUE),
  ('632', 'BULLTICK CB', TRUE),
  ('633', 'STERLING', TRUE),
  ('634', 'FINCOMUN', TRUE),
  ('636', 'HDI SEGUROS', TRUE),
  ('637', 'ORDER', TRUE),
  ('638', 'AKALA', TRUE),
  ('640', 'CB JPMORGAN', TRUE),
  ('642', 'REFORMA', TRUE),
  ('646', 'STP', TRUE),
  ('647', 'TELECOMM', TRUE),
  ('648', 'EVERCORE', TRUE),
  ('649', 'SKANDIA', TRUE),
  ('651', 'SEGMTY', TRUE),
  ('652', 'ASEA', TRUE),
  ('653', 'KUSPIT', TRUE),
  ('655', 'SOFIEXPRESS', TRUE),
  ('656', 'UNAGRA', TRUE),
  ('659', 'OPCIONES EMPRESARIALES DEL NOROESTE', TRUE),
  ('670', 'LIBERTAD', TRUE),
  ('901', 'CLS', TRUE),
  ('902', 'INDEVAL', TRUE)
ON CONFLICT (codigo) DO UPDATE
SET nombre = EXCLUDED.nombre,
    activo = EXCLUDED.activo,
    updated_at = now();

ALTER TABLE public.cuentas_bancarias_prestador
  ADD COLUMN IF NOT EXISTS banco_codigo text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cuentas_bancarias_prestador_banco_codigo_check'
  ) THEN
    ALTER TABLE public.cuentas_bancarias_prestador
      ADD CONSTRAINT cuentas_bancarias_prestador_banco_codigo_check
      CHECK (banco_codigo IS NULL OR banco_codigo ~ '^[0-9]{3}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cuentas_bancarias_prestador_banco_codigo_fkey'
  ) THEN
    ALTER TABLE public.cuentas_bancarias_prestador
      ADD CONSTRAINT cuentas_bancarias_prestador_banco_codigo_fkey
      FOREIGN KEY (banco_codigo)
      REFERENCES public.bancos_clabe(codigo)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE public.bancos_clabe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_ve_bancos_clabe ON public.bancos_clabe;
CREATE POLICY authenticated_ve_bancos_clabe
  ON public.bancos_clabe
  FOR SELECT
  TO authenticated
  USING (activo = TRUE);

DROP POLICY IF EXISTS admin_gestiona_bancos_clabe ON public.bancos_clabe;
CREATE POLICY admin_gestiona_bancos_clabe
  ON public.bancos_clabe
  TO authenticated
  USING ((SELECT public.es_admin() AS es_admin))
  WITH CHECK ((SELECT public.es_admin() AS es_admin));

DROP POLICY IF EXISTS prestador_actualiza_su_cuenta_bancaria ON public.cuentas_bancarias_prestador;
DROP POLICY IF EXISTS prestador_crea_su_cuenta_bancaria ON public.cuentas_bancarias_prestador;

DROP POLICY IF EXISTS admin_crea_cuentas_bancarias_prestador ON public.cuentas_bancarias_prestador;
CREATE POLICY admin_crea_cuentas_bancarias_prestador
  ON public.cuentas_bancarias_prestador
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.es_admin() AS es_admin));

DROP POLICY IF EXISTS admin_actualiza_cuentas_bancarias_prestador ON public.cuentas_bancarias_prestador;
CREATE POLICY admin_actualiza_cuentas_bancarias_prestador
  ON public.cuentas_bancarias_prestador
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.es_admin() AS es_admin))
  WITH CHECK ((SELECT public.es_admin() AS es_admin));
