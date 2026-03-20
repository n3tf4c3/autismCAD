INSERT INTO roles (slug, nome)
VALUES ('profissional', 'Profissional')
ON CONFLICT (slug) DO NOTHING;

UPDATE roles
SET nome = 'Profissional'
WHERE slug IN ('profissional', 'terapeuta');

INSERT INTO permissions (resource, action)
VALUES
  ('profissionais', 'view'),
  ('profissionais', 'create'),
  ('profissionais', 'edit'),
  ('profissionais', 'edit_self'),
  ('profissionais', 'delete')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT rp.role, p_new.id
FROM role_permissions rp
INNER JOIN permissions p_old
  ON p_old.id = rp.permission_id
 AND p_old.resource = 'terapeutas'
INNER JOIN permissions p_new
  ON p_new.resource = 'profissionais'
 AND p_new.action = p_old.action
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'profissional', rp.permission_id
FROM role_permissions rp
WHERE rp.role = 'terapeuta'
ON CONFLICT DO NOTHING;

UPDATE users
SET role = 'profissional'
WHERE role = 'terapeuta';

UPDATE users AS u
SET role = 'profissional'
WHERE NOT EXISTS (
  SELECT 1
  FROM roles AS r
  WHERE r.slug = u.role
);

ALTER TABLE users
  ALTER COLUMN role SET DEFAULT 'profissional';
