# Transaction Migration Plan (Neon)

## Goal

Guarantee atomic writes in critical flows by migrating from `neon-http` fallback behavior to a transaction-capable driver.

## Current Controls

- `DATABASE_DRIVER`:
  - `neon-http` (default, compatibility mode)
  - `neon-serverless` (supports transactions)
- `REQUIRE_DB_TRANSACTIONS`:
  - `0` (default): allows non-transaction fallback when driver does not support transactions
  - `1`: blocks fallback and fails with `TRANSACTION_UNSUPPORTED`

## When To Use `runDbTransaction`

- Use `runDbTransaction` only when a write flow spans multiple SQL statements and requires all-or-nothing behavior.
- Do not add `runDbTransaction` around a single `INSERT`, `UPDATE`, or `DELETE` just for stylistic consistency. A single SQL statement is already atomic at the database level.
- Prefer `mode: "required"` for flows where partial persistence would be a bug.
- If a flow is currently one statement but is likely to gain pre-checks or secondary writes soon, document that intent before adding a transaction wrapper.
- With `DATABASE_DRIVER=neon-http`, `mode: "required"` will fail with `TRANSACTION_UNSUPPORTED`, so unnecessary wrappers increase operational risk without adding correctness.

## Rollout Steps

1. Staging config:
   - `DATABASE_DRIVER=neon-serverless`
   - `REQUIRE_DB_TRANSACTIONS=1`
2. Deploy and run smoke tests for critical flows.
3. Monitor API 5xx and logs for `TRANSACTION_UNSUPPORTED`.
4. Production canary:
   - Apply same env values to a subset of traffic.
5. Full production rollout.
6. After stable period, remove fallback path from `runDbTransaction`.

## Critical Flow Validation

### 1) `pacientes.salvarPaciente`

- Path: `src/server/modules/pacientes/pacientes.service.ts`
- Scenario:
  - Save patient with multiple therapies.
  - Force failure after patient update/insert (e.g. invalid therapy insertion payload).
- Expected:
  - No partial patient/therapy state is persisted.

### 2) `prontuario.salvarDocumento`

- Path: `src/server/modules/prontuario/prontuario.service.ts`
- Scenario:
  - Concurrent creates for same patient/type.
- Expected:
  - Version increments atomically, no duplicate active version write.

### 3) `anamnese.salvarAnamneseCompleta`

- Path: `src/server/modules/anamnese/anamnese.service.ts`
- Scenario:
  - Save base record + version in one operation under concurrent requests.
- Expected:
  - Base and version remain consistent (no orphan/incomplete versioning).

### 4) `terapeutas.deleteTerapeuta`

- Path: `src/server/modules/terapeutas/terapeutas.service.ts`
- Scenario:
  - Nullify linked `atendimentos.terapeuta_id` and delete therapist.
  - Force failure between steps.
- Expected:
  - No half-applied state (both operations commit or rollback).

### 5) `pacientes.arquivos.commit`

- Path: `src/app/api/pacientes/[id]/arquivos/commit/route.ts`
- Scenario:
  - Update patient file key while reading previous key in same transaction.
  - Force update failure.
- Expected:
  - No invalid pointer persisted; previous key stays unchanged.

## Operational Checks

- `npm run lint`
- `npm run typecheck`
- API smoke test for:
  - `POST /api/pacientes`
  - `POST /api/prontuario/documento/:id`
  - `POST /api/anamnese`
  - `DELETE /api/terapeutas/:id`
  - `POST /api/pacientes/:id/arquivos/commit`
