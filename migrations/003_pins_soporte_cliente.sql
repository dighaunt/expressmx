

CREATE TABLE IF NOT EXISTS pins_soporte_cliente (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  pin_hash     TEXT NOT NULL,
  generado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_en    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  usado_por    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  usado_en     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pins_soporte_cliente
  ON pins_soporte_cliente(cliente_id) WHERE usado_en IS NULL;

CREATE INDEX IF NOT EXISTS idx_pins_soporte_vigentes
  ON pins_soporte_cliente(expira_en) WHERE usado_en IS NULL;

CREATE TABLE IF NOT EXISTS casos_soporte_abiertos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id       UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  cliente_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  pin_id          UUID NOT NULL REFERENCES pins_soporte_cliente(id) ON DELETE RESTRICT,
  abierto_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_en       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '4 hours'),
  cerrado_en      TIMESTAMPTZ,
  motivo_cierre   TEXT,
  notas           TEXT
);

CREATE INDEX IF NOT EXISTS idx_casos_soporte_agente_activo
  ON casos_soporte_abiertos(agente_id, expira_en)
  WHERE cerrado_en IS NULL;

CREATE INDEX IF NOT EXISTS idx_casos_soporte_cliente
  ON casos_soporte_abiertos(cliente_id);

ALTER TABLE pins_soporte_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE casos_soporte_abiertos ENABLE ROW LEVEL SECURITY;
