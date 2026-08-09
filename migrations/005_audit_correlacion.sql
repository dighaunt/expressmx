

ALTER TABLE logs_auditoria
  ADD COLUMN IF NOT EXISTS caso_id   UUID REFERENCES casos_soporte_abiertos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES tickets_soporte(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_log_caso   ON logs_auditoria(caso_id)   WHERE caso_id   IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_log_ticket ON logs_auditoria(ticket_id) WHERE ticket_id IS NOT NULL;

ALTER TABLE casos_soporte_abiertos
  ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES tickets_soporte(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_caso_ticket ON casos_soporte_abiertos(ticket_id)
  WHERE ticket_id IS NOT NULL;
