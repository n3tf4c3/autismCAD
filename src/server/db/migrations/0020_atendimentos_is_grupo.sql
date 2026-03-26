ALTER TABLE atendimentos
  ADD COLUMN IF NOT EXISTS is_grupo boolean NOT NULL DEFAULT false;
