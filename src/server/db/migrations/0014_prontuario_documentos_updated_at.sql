ALTER TABLE prontuario_documentos
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE prontuario_documentos
SET updated_at = created_at
WHERE updated_at IS NULL;

ALTER TABLE prontuario_documentos
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prontuario_documentos_updated_at
  ON prontuario_documentos(updated_at);
