# Operação do banco de dados

Guia operacional para evitar divergência de schema entre ambientes (achado 48).

## Caminho oficial: `db:migrate`

O bootstrap e a evolução do banco em qualquer ambiente persistente (produção,
homologação, banco compartilhado de desenvolvimento) devem ser feitos **somente**
por migrations versionadas:

```bash
npm run db:migrate
```

A baseline `packages/db/src/migrations/0000_baseline.sql` cria tabelas, índices, FKs,
**funções** (`jsonb_is_positive_int_array`, `set_updated_at`) e **triggers**
(`trg_*_set_updated_at`). O schema Drizzle referencia essas funções em `check`
constraints. `npm run db:check` valida a consistência das migrations.

## `db:push` é proibido fora de sandbox descartável

```bash
# PERMITIDO apenas em banco local descartável de desenvolvimento.
npm run db:push
```

`db:push` sincroniza o schema do Drizzle direto no banco, **sem aplicar a DDL
manual** das migrations (funções/triggers). Usá-lo em um ambiente persistente pode:

- criar um banco sem as funções/triggers exigidas pelos checks, ou falhar nos checks;
- gerar drift em relação ao que `db:migrate` produz.

Regra: **nunca** rodar `db:push` apontando para um banco que não possa ser
descartado e recriado por `db:migrate`. Para qualquer banco real, use `db:migrate`.

## Scripts de cleanup de payload (achados 89, 98)

Saneiam JSONB legado (`evolucoes`, `anamnese`/`anamnese_versions`, `prontuario_documentos`
do tipo `PLANO_ENSINO`). Expostos em `apps/web/package.json`:

```bash
# 1) SEMPRE rode primeiro em dry-run (nao escreve nada) e revise o relatorio JSON.
npm run db:cleanup:evolucao -w @autismcad/web
npm run db:cleanup:anamnese -w @autismcad/web
npm run db:cleanup:plano-ensino -w @autismcad/web

# 2) Para aplicar, adicione --apply. Contra banco REMOTO exige confirmacao explicita:
npm run db:cleanup:evolucao -w @autismcad/web -- --apply --yes-prod
# ou: CLEANUP_CONFIRM=1 npm run db:cleanup:evolucao -w @autismcad/web -- --apply
```

Salvaguardas (`scripts/db/_cleanup-safety.ts`): cada execucao loga o alvo mascarado
(`host/database`) e o modo. Em `--apply` contra host nao-local, aborta sem
`--yes-prod` (ou `CLEANUP_CONFIRM=1`), evitando execucao acidental em producao.

### Atomicidade e reexecucao

Os updates sao aplicados linha a linha, **sem** transacao envolvendo todo o lote.
O driver atual (`drizzle-orm/neon-http`) e stateless por requisicao HTTP e lanca
`No transactions support in neon-http driver`; atomicidade de lote exigiria trocar
para um driver transacional (WebSocket Pool / `postgres-js`) — ver
`docs/transactions-migration-plan.md`.

Mitigacao enquanto isso: os scripts sao **idempotentes** — o saneamento e
deterministico e cada linha so e escrita quando muda (`changed`). Uma falha no meio
do lote e recuperavel apenas reexecutando o script (dry-run e depois `--apply`):
linhas ja saneadas sao puladas e o resultado final converge.

## Localizacao atual no monorepo

- Schema Drizzle: `packages/db/src/schema.ts`.
- Migrations: `packages/db/src/migrations/`.
- Config Drizzle: `packages/db/drizzle.config.ts`.
- Variaveis de ambiente carregadas pelo Drizzle: `apps/web/.env.local` e `apps/web/.env`.
- Scripts da raiz delegam para `@autismcad/db`; tambem e possivel rodar com `-w @autismcad/db`.
