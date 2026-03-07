DROP INDEX IF EXISTS uk_evolucoes_paciente_terapeuta_data_ativo;

CREATE UNIQUE INDEX IF NOT EXISTS uk_evolucoes_atendimento_ativo
  ON evolucoes (atendimento_id)
  WHERE deleted_at IS NULL
    AND atendimento_id IS NOT NULL;
