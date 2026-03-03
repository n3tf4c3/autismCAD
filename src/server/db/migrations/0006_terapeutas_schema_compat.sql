DO $$
BEGIN
  IF to_regclass('public.terapeutas') IS NOT NULL THEN
    ALTER TABLE public.terapeutas
      ADD COLUMN IF NOT EXISTS data_nascimento DATE,
      ADD COLUMN IF NOT EXISTS email VARCHAR(120),
      ADD COLUMN IF NOT EXISTS telefone VARCHAR(20),
      ADD COLUMN IF NOT EXISTS endereco VARCHAR(255),
      ADD COLUMN IF NOT EXISTS logradouro VARCHAR(180),
      ADD COLUMN IF NOT EXISTS numero VARCHAR(20),
      ADD COLUMN IF NOT EXISTS bairro VARCHAR(120),
      ADD COLUMN IF NOT EXISTS cidade VARCHAR(120),
      ADD COLUMN IF NOT EXISTS cep VARCHAR(8),
      ADD COLUMN IF NOT EXISTS especialidade VARCHAR(80) NOT NULL DEFAULT 'Nao informado',
      ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS deleted_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS usuario_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

DROP INDEX IF EXISTS uk_terapeutas_cpf;

CREATE UNIQUE INDEX IF NOT EXISTS uk_terapeutas_cpf_ativo
  ON terapeutas(cpf)
  WHERE deleted_at IS NULL AND cpf IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_terapeutas_usuario
  ON terapeutas(usuario_id);

CREATE INDEX IF NOT EXISTS idx_terapeutas_nome
  ON terapeutas(nome);

CREATE INDEX IF NOT EXISTS idx_terapeutas_deleted_at
  ON terapeutas(deleted_at);
