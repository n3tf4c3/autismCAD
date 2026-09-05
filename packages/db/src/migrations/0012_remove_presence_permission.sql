-- Achado 147: remocao da permissao inerte aprovada em 2026-09-05.
-- Limpeza idempotente: a FK remove somente os respectivos role_permissions.
DELETE FROM "permissions" WHERE "resource" = 'consultas' AND "action" = 'presence';
