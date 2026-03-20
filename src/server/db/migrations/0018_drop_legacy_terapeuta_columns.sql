DROP TRIGGER IF EXISTS trg_sync_atendimentos_profissional_terapeuta ON atendimentos;
DROP TRIGGER IF EXISTS trg_sync_evolucoes_profissional_terapeuta ON evolucoes;

DROP FUNCTION IF EXISTS fn_sync_atendimentos_profissional_terapeuta();
DROP FUNCTION IF EXISTS fn_sync_evolucoes_profissional_terapeuta();

ALTER TABLE atendimentos
  DROP CONSTRAINT IF EXISTS ck_atendimentos_profissional_terapeuta_sync;

ALTER TABLE evolucoes
  DROP CONSTRAINT IF EXISTS ck_evolucoes_profissional_terapeuta_sync;

DROP INDEX IF EXISTS idx_atend_terapeuta;
DROP INDEX IF EXISTS idx_atend_data_terapeuta;
DROP INDEX IF EXISTS idx_evolucoes_terapeuta;

ALTER TABLE atendimentos
  DROP COLUMN IF EXISTS terapeuta_id;

ALTER TABLE evolucoes
  DROP COLUMN IF EXISTS terapeuta_id;

ALTER TABLE evolucoes
  ALTER COLUMN profissional_id SET NOT NULL;
