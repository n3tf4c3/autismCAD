CREATE TABLE IF NOT EXISTS user_paciente_vinculos (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  paciente_id BIGINT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_paciente_vinculos_paciente
  ON user_paciente_vinculos(paciente_id);

INSERT INTO roles (slug, nome)
VALUES ('responsavel', 'Responsavel')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'responsavel', p.id
FROM permissions p
WHERE (p.resource = 'prontuario' AND p.action = 'view')
   OR (p.resource = 'relatorios_clinicos' AND p.action = 'view')
ON CONFLICT DO NOTHING;
