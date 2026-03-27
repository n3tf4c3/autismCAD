DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.atendimentos
    WHERE profissional_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Nao foi possivel aplicar 0023_atendimentos_profissional_not_null: existem atendimentos com profissional_id nulo.';
  END IF;

  ALTER TABLE public.atendimentos
    ALTER COLUMN profissional_id SET NOT NULL;
END $$;

