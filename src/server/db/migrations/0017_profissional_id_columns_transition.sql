ALTER TABLE atendimentos
  ADD COLUMN IF NOT EXISTS profissional_id BIGINT;

ALTER TABLE evolucoes
  ADD COLUMN IF NOT EXISTS profissional_id BIGINT;

UPDATE atendimentos
SET profissional_id = terapeuta_id
WHERE profissional_id IS NULL
  AND terapeuta_id IS NOT NULL;

UPDATE atendimentos
SET terapeuta_id = profissional_id
WHERE terapeuta_id IS NULL
  AND profissional_id IS NOT NULL;

UPDATE evolucoes
SET profissional_id = terapeuta_id
WHERE profissional_id IS NULL
  AND terapeuta_id IS NOT NULL;

UPDATE evolucoes
SET terapeuta_id = profissional_id
WHERE terapeuta_id IS NULL
  AND profissional_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_atendimentos_profissional_id'
  ) THEN
    ALTER TABLE atendimentos
      ADD CONSTRAINT fk_atendimentos_profissional_id
      FOREIGN KEY (profissional_id) REFERENCES terapeutas(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_evolucoes_profissional_id'
  ) THEN
    ALTER TABLE evolucoes
      ADD CONSTRAINT fk_evolucoes_profissional_id
      FOREIGN KEY (profissional_id) REFERENCES terapeutas(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_atendimentos_profissional_terapeuta_sync'
  ) THEN
    ALTER TABLE atendimentos
      ADD CONSTRAINT ck_atendimentos_profissional_terapeuta_sync
      CHECK (
        profissional_id IS NULL
        OR terapeuta_id IS NULL
        OR profissional_id = terapeuta_id
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_evolucoes_profissional_terapeuta_sync'
  ) THEN
    ALTER TABLE evolucoes
      ADD CONSTRAINT ck_evolucoes_profissional_terapeuta_sync
      CHECK (profissional_id = terapeuta_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION fn_sync_atendimentos_profissional_terapeuta()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.profissional_id IS NULL AND NEW.terapeuta_id IS NOT NULL THEN
    NEW.profissional_id := NEW.terapeuta_id;
  ELSIF NEW.terapeuta_id IS NULL AND NEW.profissional_id IS NOT NULL THEN
    NEW.terapeuta_id := NEW.profissional_id;
  ELSIF NEW.profissional_id IS NOT NULL AND NEW.terapeuta_id IS NOT NULL AND NEW.profissional_id <> NEW.terapeuta_id THEN
    NEW.terapeuta_id := NEW.profissional_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_atendimentos_profissional_terapeuta ON atendimentos;
CREATE TRIGGER trg_sync_atendimentos_profissional_terapeuta
BEFORE INSERT OR UPDATE OF profissional_id, terapeuta_id
ON atendimentos
FOR EACH ROW
EXECUTE FUNCTION fn_sync_atendimentos_profissional_terapeuta();

CREATE OR REPLACE FUNCTION fn_sync_evolucoes_profissional_terapeuta()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.profissional_id IS NULL AND NEW.terapeuta_id IS NOT NULL THEN
    NEW.profissional_id := NEW.terapeuta_id;
  ELSIF NEW.terapeuta_id IS NULL AND NEW.profissional_id IS NOT NULL THEN
    NEW.terapeuta_id := NEW.profissional_id;
  ELSIF NEW.profissional_id IS NOT NULL AND NEW.terapeuta_id IS NOT NULL AND NEW.profissional_id <> NEW.terapeuta_id THEN
    NEW.terapeuta_id := NEW.profissional_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_evolucoes_profissional_terapeuta ON evolucoes;
CREATE TRIGGER trg_sync_evolucoes_profissional_terapeuta
BEFORE INSERT OR UPDATE OF profissional_id, terapeuta_id
ON evolucoes
FOR EACH ROW
EXECUTE FUNCTION fn_sync_evolucoes_profissional_terapeuta();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM evolucoes
    WHERE profissional_id IS NULL
  ) THEN
    ALTER TABLE evolucoes
      ALTER COLUMN profissional_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_atend_profissional
  ON atendimentos(profissional_id);

CREATE INDEX IF NOT EXISTS idx_atend_data_profissional
  ON atendimentos(data, profissional_id);

CREATE INDEX IF NOT EXISTS idx_evolucoes_profissional
  ON evolucoes(profissional_id);
