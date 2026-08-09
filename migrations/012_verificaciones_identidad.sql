

CREATE TABLE IF NOT EXISTS verificaciones_identidad_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets_soporte(id) ON DELETE CASCADE,
  pin_id UUID REFERENCES pins_soporte_cliente(id) ON DELETE SET NULL,
  metodo TEXT NOT NULL CHECK (metodo IN ('pin','email','documento','transferida')),
  verificado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  verificado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  consumida_por TEXT[] DEFAULT '{}',
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verif_identidad_ticket
  ON verificaciones_identidad_cliente(ticket_id, expira_at DESC);

CREATE INDEX IF NOT EXISTS idx_verif_identidad_cliente
  ON verificaciones_identidad_cliente(cliente_id, expira_at DESC);
