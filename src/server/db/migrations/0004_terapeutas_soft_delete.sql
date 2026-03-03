ALTER TABLE terapeutas
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS uk_terapeutas_cpf;

CREATE UNIQUE INDEX IF NOT EXISTS uk_terapeutas_cpf_ativo
  ON terapeutas(cpf)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_terapeutas_deleted_at
  ON terapeutas(deleted_at);
