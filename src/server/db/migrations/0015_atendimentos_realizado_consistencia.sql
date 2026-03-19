UPDATE public.atendimentos
SET realizado = (presenca = 'Presente')
WHERE realizado IS DISTINCT FROM (presenca = 'Presente');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_atendimentos_realizado_presenca'
      AND conrelid = 'public.atendimentos'::regclass
  ) THEN
    ALTER TABLE public.atendimentos
      ADD CONSTRAINT ck_atendimentos_realizado_presenca
      CHECK (realizado = (presenca = 'Presente'));
  END IF;
END $$;
