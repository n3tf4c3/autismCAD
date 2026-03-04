DELETE FROM user_paciente_vinculos a
USING user_paciente_vinculos b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.paciente_id = b.paciente_id;

DO $$
DECLARE
  current_pk text;
BEGIN
  SELECT c.conname
  INTO current_pk
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE c.contype = 'p'
    AND n.nspname = 'public'
    AND t.relname = 'user_paciente_vinculos'
  LIMIT 1;

  IF current_pk IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE user_paciente_vinculos DROP CONSTRAINT %I',
      current_pk
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.contype = 'p'
      AND n.nspname = 'public'
      AND t.relname = 'user_paciente_vinculos'
  ) THEN
    ALTER TABLE user_paciente_vinculos
      ADD CONSTRAINT pk_user_paciente_vinculos PRIMARY KEY (user_id, paciente_id);
  END IF;
END $$;
