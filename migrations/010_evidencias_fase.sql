

BEGIN;

ALTER TABLE public.evidencias_orden
  ADD COLUMN IF NOT EXISTS fase text NOT NULL DEFAULT 'antes'
  CHECK (fase IN ('antes', 'despues'));

CREATE INDEX IF NOT EXISTS idx_evidencias_orden_fase
  ON public.evidencias_orden(orden_id, fase);

COMMIT;
