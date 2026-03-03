DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT *
    FROM (
      VALUES
        ('users', 'created_at'),
        ('users', 'updated_at'),
        ('access_logs', 'created_at'),
        ('pacientes', 'deleted_at'),
        ('pacientes', 'created_at'),
        ('pacientes', 'updated_at'),
        ('terapeutas', 'deleted_at'),
        ('terapeutas', 'created_at'),
        ('terapeutas', 'updated_at'),
        ('atendimentos', 'deleted_at'),
        ('atendimentos', 'created_at'),
        ('atendimentos', 'updated_at'),
        ('anamnese', 'created_at'),
        ('anamnese', 'updated_at'),
        ('anamnese_versions', 'created_at'),
        ('prontuario_documentos', 'created_at'),
        ('prontuario_documentos', 'deleted_at'),
        ('evolucoes', 'created_at'),
        ('evolucoes', 'updated_at'),
        ('evolucoes', 'deleted_at')
    ) AS cols(table_name, column_name)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = rec.table_name
        AND c.column_name = rec.column_name
        AND c.data_type = 'timestamp without time zone'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN %I TYPE TIMESTAMPTZ USING %I AT TIME ZONE ''UTC''',
        rec.table_name,
        rec.column_name,
        rec.column_name
      );
    END IF;
  END LOOP;
END $$;
