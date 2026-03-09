DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pacientes_deleted_by_user_id_users_id_fk'
  ) THEN
    ALTER TABLE pacientes
      ADD CONSTRAINT pacientes_deleted_by_user_id_users_id_fk
      FOREIGN KEY (deleted_by_user_id)
      REFERENCES users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'atendimentos_deleted_by_user_id_users_id_fk'
  ) THEN
    ALTER TABLE atendimentos
      ADD CONSTRAINT atendimentos_deleted_by_user_id_users_id_fk
      FOREIGN KEY (deleted_by_user_id)
      REFERENCES users(id)
      ON DELETE SET NULL;
  END IF;
END $$;
