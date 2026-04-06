DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.terapeutas
    WHERE deleted_at IS NULL
      AND usuario_id IS NOT NULL
    GROUP BY usuario_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Nao foi possivel aplicar 0024_terapeutas_usuario_unique: existem terapeutas ativos duplicados para o mesmo usuario_id.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uk_terapeutas_usuario_ativo
  ON terapeutas(usuario_id)
  WHERE deleted_at IS NULL
    AND usuario_id IS NOT NULL;
