CREATE OR REPLACE FUNCTION public.jsonb_is_positive_int_array(payload JSONB)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    jsonb_typeof(payload) = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(payload) AS item(value)
      WHERE jsonb_typeof(value) <> 'number'
         OR value::text !~ '^[1-9][0-9]*$'
    );
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.user_paciente_vinculos_audit
    WHERE NOT public.jsonb_is_positive_int_array(removed_paciente_ids)
  ) THEN
    RAISE EXCEPTION
      'Nao foi possivel aplicar 0028_user_paciente_vinculos_audit_positive_int_array_fn: removed_paciente_ids contem valor invalido.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_user_paciente_vinculos_audit_removed_ids_positive_int'
  ) THEN
    ALTER TABLE public.user_paciente_vinculos_audit
      DROP CONSTRAINT ck_user_paciente_vinculos_audit_removed_ids_positive_int;
  END IF;

  ALTER TABLE public.user_paciente_vinculos_audit
    ADD CONSTRAINT ck_user_paciente_vinculos_audit_removed_ids_positive_int
    CHECK (public.jsonb_is_positive_int_array(removed_paciente_ids));
END $$;
