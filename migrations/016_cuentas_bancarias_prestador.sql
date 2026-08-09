CREATE TABLE IF NOT EXISTS public.cuentas_bancarias_prestador (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prestador_id uuid NOT NULL,
    titular text NOT NULL,
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
    CONSTRAINT cuentas_bancarias_prestador_clabe_ultimos4_check CHECK (clabe_ultimos4 ~ '^[0-9]{4}$'),
    CONSTRAINT cuentas_bancarias_prestador_estatus_check CHECK (estatus = ANY (ARRAY['pendiente'::text, 'verificada'::text, 'rechazada'::text])),
    CONSTRAINT cuentas_bancarias_prestador_titular_check CHECK (length(btrim(titular)) >= 5),
    CONSTRAINT cuentas_bancarias_prestador_banco_check CHECK (length(btrim(banco_nombre)) >= 2)
);

ALTER TABLE ONLY public.cuentas_bancarias_prestador
    ADD CONSTRAINT cuentas_bancarias_prestador_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cuentas_bancarias_prestador
    ADD CONSTRAINT cuentas_bancarias_prestador_prestador_id_key UNIQUE (prestador_id);

ALTER TABLE ONLY public.cuentas_bancarias_prestador
    ADD CONSTRAINT cuentas_bancarias_prestador_clabe_hash_key UNIQUE (clabe_hash);

ALTER TABLE ONLY public.cuentas_bancarias_prestador
    ADD CONSTRAINT cuentas_bancarias_prestador_prestador_id_fkey FOREIGN KEY (prestador_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cuentas_bancarias_prestador
    ADD CONSTRAINT cuentas_bancarias_prestador_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cuenta_bancaria_prestador_estatus ON public.cuentas_bancarias_prestador USING btree (estatus, updated_at DESC);

ALTER TABLE public.cuentas_bancarias_prestador ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_ve_cuentas_bancarias_prestador ON public.cuentas_bancarias_prestador;
CREATE POLICY admin_ve_cuentas_bancarias_prestador
  ON public.cuentas_bancarias_prestador
  FOR SELECT
  TO authenticated
  USING ((SELECT public.es_admin() AS es_admin));

DROP POLICY IF EXISTS prestador_ve_su_cuenta_bancaria ON public.cuentas_bancarias_prestador;
CREATE POLICY prestador_ve_su_cuenta_bancaria
  ON public.cuentas_bancarias_prestador
  FOR SELECT
  TO authenticated
  USING (prestador_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS prestador_crea_su_cuenta_bancaria ON public.cuentas_bancarias_prestador;
CREATE POLICY prestador_crea_su_cuenta_bancaria
  ON public.cuentas_bancarias_prestador
  FOR INSERT
  TO authenticated
  WITH CHECK (prestador_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS prestador_actualiza_su_cuenta_bancaria ON public.cuentas_bancarias_prestador;
CREATE POLICY prestador_actualiza_su_cuenta_bancaria
  ON public.cuentas_bancarias_prestador
  FOR UPDATE
  TO authenticated
  USING (prestador_id = (SELECT auth.uid()))
  WITH CHECK (prestador_id = (SELECT auth.uid()));
