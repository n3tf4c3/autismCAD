INSERT INTO roles (slug, nome)
VALUES
  ('admin-geral', 'Administrador Geral'),
  ('admin', 'Administrador'),
  ('terapeuta', 'Profissional'),
  ('recepcao', 'Recepcao')
ON CONFLICT (slug) DO NOTHING;

UPDATE users AS u
SET role = 'terapeuta'
WHERE NOT EXISTS (
  SELECT 1
  FROM roles AS r
  WHERE r.slug = u.role
);

DELETE FROM role_permissions AS rp
WHERE NOT EXISTS (
  SELECT 1
  FROM roles AS r
  WHERE r.slug = rp.role
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_role_roles_slug'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT fk_users_role_roles_slug
      FOREIGN KEY (role)
      REFERENCES roles(slug)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_role_permissions_role_roles_slug'
  ) THEN
    ALTER TABLE role_permissions
      ADD CONSTRAINT fk_role_permissions_role_roles_slug
      FOREIGN KEY (role)
      REFERENCES roles(slug)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
  END IF;
END $$;
