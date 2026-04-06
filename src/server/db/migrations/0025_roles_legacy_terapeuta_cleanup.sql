INSERT INTO roles (slug, nome)
VALUES ('profissional', 'Profissional')
ON CONFLICT (slug) DO NOTHING;

UPDATE users
SET role = 'profissional'
WHERE role = 'terapeuta';

INSERT INTO role_permissions (role, permission_id)
SELECT 'profissional', rp.permission_id
FROM role_permissions rp
WHERE rp.role = 'terapeuta'
ON CONFLICT DO NOTHING;

DELETE FROM role_permissions
WHERE role = 'terapeuta';

DELETE FROM roles
WHERE slug = 'terapeuta';