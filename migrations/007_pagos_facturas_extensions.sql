

DO $check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pagos') THEN
    RAISE EXCEPTION 'Schema base no encontrado: tabla "pagos" no existe. Aplica 00.sql + migraciones 001-006 antes de 007.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'facturas') THEN
    RAISE EXCEPTION 'Schema base no encontrado: tabla "facturas" no existe. Aplica 00.sql + migraciones 001-006 antes de 007.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'auth' AND p.proname = 'uid') THEN
    RAISE EXCEPTION 'Funcion auth.uid() no existe. Aplica 00.sql primero.';
  END IF;
END
$check$;

ALTER TYPE estatus_factura ADD VALUE IF NOT EXISTS 'pendiente_timbrado';
ALTER TYPE estatus_factura ADD VALUE IF NOT EXISTS 'fallida';

ALTER TABLE pagos ADD COLUMN IF NOT EXISTS payment_intent_id    TEXT;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS customer_id_pasarela TEXT;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS webhook_received_at  TIMESTAMPTZ;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS raw_status           TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pagos_payment_intent
  ON pagos(payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pagos_customer_pasarela
  ON pagos(customer_id_pasarela)
  WHERE customer_id_pasarela IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pagos_estatus_created
  ON pagos(estatus, created_at DESC);

CREATE TABLE IF NOT EXISTS pagos_metodos_guardados (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id        UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  payment_method_id TEXT NOT NULL UNIQUE,
  brand             TEXT,
  last4             TEXT,
  exp_month         SMALLINT,
  exp_year          SMALLINT,
  predeterminado    BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_metodos_usuario
  ON pagos_metodos_guardados(usuario_id)
  WHERE deleted_at IS NULL;

ALTER TABLE pagos_metodos_guardados ENABLE ROW LEVEL SECURITY;

DO $pol$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pagos_metodos_guardados'
      AND policyname = 'ver_mis_metodos'
  ) THEN
    CREATE POLICY "ver_mis_metodos" ON pagos_metodos_guardados FOR SELECT TO authenticated
      USING (usuario_id = (SELECT auth.uid()) AND deleted_at IS NULL);
  END IF;
END
$pol$;

CREATE TABLE IF NOT EXISTS webhook_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor    TEXT NOT NULL,
  external_id  TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  payload      JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  error        TEXT,
  retry_count  INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_webhook_event UNIQUE (proveedor, external_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_proveedor_type
  ON webhook_events(proveedor, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_unprocessed
  ON webhook_events(created_at)
  WHERE processed_at IS NULL;

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

DO $pol$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'webhook_events'
      AND policyname = 'admin_ve_webhook_events'
  ) THEN
    CREATE POLICY "admin_ve_webhook_events" ON webhook_events FOR SELECT TO authenticated
      USING ((SELECT es_admin()));
  END IF;
END
$pol$;

ALTER TABLE facturas ADD COLUMN IF NOT EXISTS solicitada_por   UUID REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS uso_cfdi         TEXT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS forma_pago       TEXT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS metodo_pago_sat  TEXT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS serie            TEXT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS folio            TEXT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS pac_proveedor    TEXT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS pac_referencia   TEXT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS cancelada_at     TIMESTAMPTZ;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS cancelada_motivo TEXT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS xml_contenido    TEXT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS pdf_contenido    TEXT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS pago_id          UUID REFERENCES pagos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_facturas_solicitada_por
  ON facturas(solicitada_por)
  WHERE solicitada_por IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_facturas_pago
  ON facturas(pago_id)
  WHERE pago_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_facturas_estatus
  ON facturas(estatus, created_at DESC);
