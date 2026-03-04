DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'access_logs'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE access_logs
      ALTER COLUMN created_at TYPE TIMESTAMPTZ
      USING created_at AT TIME ZONE 'UTC';
  END IF;
END $$;
