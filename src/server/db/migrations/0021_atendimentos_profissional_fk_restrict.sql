DO $$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_class ref ON ref.oid = c.confrelid
    JOIN pg_attribute att
      ON att.attrelid = rel.oid
     AND att.attnum = ANY (c.conkey)
    WHERE c.contype = 'f'
      AND nsp.nspname = 'public'
      AND rel.relname = 'atendimentos'
      AND ref.relname = 'terapeutas'
      AND att.attname = 'profissional_id'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.atendimentos DROP CONSTRAINT IF EXISTS %I',
      constraint_row.conname
    );
  END LOOP;

  ALTER TABLE public.atendimentos
    ADD CONSTRAINT fk_atendimentos_profissional_id
    FOREIGN KEY (profissional_id)
    REFERENCES public.terapeutas(id)
    ON DELETE RESTRICT;
END $$;
