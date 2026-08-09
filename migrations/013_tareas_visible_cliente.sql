ALTER TABLE tareas_caso
  ADD COLUMN IF NOT EXISTS visible_cliente BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS titulo_cliente TEXT;

CREATE INDEX IF NOT EXISTS idx_tareas_visibles_ticket ON tareas_caso(ticket_id) WHERE visible_cliente = TRUE;
