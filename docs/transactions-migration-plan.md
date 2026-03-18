# Transaction Migration Plan (Neon)

## Goal
Garantir consistencia de escrita nos fluxos criticos, com uso previsivel de transacoes e configuracao de driver adequada para producao.

## Current Controls (estado atual)

- `DATABASE_DRIVER`:
  - `neon-serverless` (default atual no codigo)
  - `neon-http` (modo de compatibilidade/fallback)
- `REQUIRE_DB_TRANSACTIONS`:
  - default dinamico:
    - `1` em `production`
    - `0` em `development`/`test`
  - valor explicito no ambiente sobrescreve esse default

Referencias:
- `src/lib/env.ts`
- `src/server/db/transaction.ts`

## Semantica atual de `runDbTransaction`

- `mode` default: `"required"`.
- Em `DATABASE_DRIVER=neon-http`, operacoes em modo `"required"` falham com `TRANSACTION_UNSUPPORTED`.
- Em modo `"allow-fallback"`, o sistema permite executar sem transacao no `neon-http` e registra warning.

## Politica atual no codigo

- A maior parte das mutacoes de dominio esta com `mode: "required"`, inclusive:
  - pacientes, terapeutas, atendimentos, anamnese, prontuario, users.
- Excecao intencional:
  - `accessLogs.recordLoginAttemptAccess` usa `mode: "allow-fallback"` para nao bloquear login por indisponibilidade de transacao.

## Fluxos criticos para validacao

### 1) `pacientes.salvarPaciente`
- Path: `src/server/modules/pacientes/pacientes.service.ts`
- Esperado: sem persistencia parcial de paciente/terapias em caso de falha intermediaria.

### 2) `prontuario.salvarDocumento`
- Path: `src/server/modules/prontuario/prontuario.service.ts`
- Esperado: versao/documento consistente sob concorrencia.

### 3) `anamnese.salvarAnamneseCompleta`
- Path: `src/server/modules/anamnese/anamnese.service.ts`
- Esperado: base + versao consistentes sem orfaos.

### 4) `terapeutas.deleteTerapeuta`
- Path: `src/server/modules/terapeutas/terapeutas.service.ts`
- Esperado: operacoes encadeadas (desvinculo + delete logico/fisico conforme regra) sem estado parcial.

### 5) `pacientes.arquivos.commit.action`
- Path: `src/app/(protected)/pacientes/paciente.actions.ts`
- Esperado: troca de chave de arquivo com leitura/escrita consistente e sem ponteiro invalido.

## Rollout recomendado de ambiente

1. Staging:
   - `DATABASE_DRIVER=neon-serverless`
   - `REQUIRE_DB_TRANSACTIONS=1`
   - preferir `DATABASE_URL_UNPOOLED` quando aplicavel
2. Executar smoke dos fluxos criticos.
3. Monitorar 5xx e ocorrencias de `TRANSACTION_UNSUPPORTED`.
4. Produzir canary em producao com mesma configuracao.
5. Rollout completo apos estabilidade.

## Operacional checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Smoke checks funcionais

Como varios fluxos sao Server Actions (e nao `route.ts` publico), validar por fluxo de UI autenticada:
- Salvar/editar paciente
- Salvar documento e evolucao de prontuario
- Salvar/excluir anamnese
- Excluir terapeuta
- Commit de arquivo de paciente

## Notas de manutencao

- Se um fluxo hoje em um unico statement crescer para multiplos passos, manter `mode: "required"` e documentar o motivo no service.
- Se um fluxo precisar resiliencia a falha de transacao por requisito de disponibilidade (caso raro), justificar explicitamente o uso de `"allow-fallback"`.
