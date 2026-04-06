DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.user_paciente_vinculos_audit
    WHERE NOT (
      jsonb_typeof(removed_paciente_ids) = 'array'
      AND removed_paciente_ids::text ~ '^\[(?:[1-9][0-9]*(?:,[1-9][0-9]*)*)?\]$'
    )
  ) THEN
    RAISE EXCEPTION
      'Nao foi possivel aplicar 0026_user_paciente_vinculos_audit_strict_ids: removed_paciente_ids contem valor invalido.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_user_paciente_vinculos_audit_removed_ids_positive_int'
  ) THEN
    ALTER TABLE public.user_paciente_vinculos_audit
      ADD CONSTRAINT ck_user_paciente_vinculos_audit_removed_ids_positive_int
      CHECK (removed_paciente_ids::text ~ '^\[(?:[1-9][0-9]*(?:,[1-9][0-9]*)*)?\]$');
  END IF;
END $$;