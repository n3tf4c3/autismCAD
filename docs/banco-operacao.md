# Operação do banco de dados

Guia operacional para evitar divergência de schema entre ambientes (achado 48).

## Caminho oficial: `db:migrate`

O bootstrap e a evolução do banco em qualquer ambiente persistente (produção,
homologação, banco compartilhado de desenvolvimento) devem ser feitos **somente**
por migrations versionadas:

```bash
npm run db:migrate
```

A baseline `src/server/db/migrations/0000_baseline.sql` cria tabelas, índices, FKs,
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
