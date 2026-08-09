

BEGIN;

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS email_verificado_en timestamp with time zone;

CREATE TABLE IF NOT EXISTS public.email_verificaciones (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  expira_en timestamp with time zone NOT NULL,
  usado_en timestamp with time zone,
  intentos integer NOT NULL DEFAULT 0,
  enviado_a text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT email_verificaciones_codigo_formato CHECK (codigo ~ '^[0-9]{6}$')
);

CREATE INDEX IF NOT EXISTS idx_email_verif_usuario_activos
  ON public.email_verificaciones(usuario_id, expira_en)
  WHERE usado_en IS NULL;

COMMIT;
