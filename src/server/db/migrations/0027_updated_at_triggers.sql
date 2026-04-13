CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON public.users;
CREATE TRIGGER trg_users_set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_pacientes_set_updated_at ON public.pacientes;
CREATE TRIGGER trg_pacientes_set_updated_at
  BEFORE UPDATE ON public.pacientes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_user_paciente_vinculos_set_updated_at ON public.user_paciente_vinculos;
CREATE TRIGGER trg_user_paciente_vinculos_set_updated_at
  BEFORE UPDATE ON public.user_paciente_vinculos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_terapeutas_set_updated_at ON public.terapeutas;
CREATE TRIGGER trg_terapeutas_set_updated_at
  BEFORE UPDATE ON public.terapeutas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_atendimentos_set_updated_at ON public.atendimentos;
CREATE TRIGGER trg_atendimentos_set_updated_at
  BEFORE UPDATE ON public.atendimentos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_anamnese_set_updated_at ON public.anamnese;
CREATE TRIGGER trg_anamnese_set_updated_at
  BEFORE UPDATE ON public.anamnese
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_prontuario_documentos_set_updated_at ON public.prontuario_documentos;
CREATE TRIGGER trg_prontuario_documentos_set_updated_at
  BEFORE UPDATE ON public.prontuario_documentos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_evolucoes_set_updated_at ON public.evolucoes;
CREATE TRIGGER trg_evolucoes_set_updated_at
  BEFORE UPDATE ON public.evolucoes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
