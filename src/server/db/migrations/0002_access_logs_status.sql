ALTER TABLE IF EXISTS access_logs
  ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'SUCESSO';

UPDATE access_logs
SET status = 'SUCESSO'
WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS idx_access_logs_status_created_at
  ON access_logs(status, created_at DESC);

