# Análise de Inconsistências — AutismCAD (Março 2026)

Reanálise do backend e frontend do projeto — Next.js 16, Drizzle ORM, NextAuth, Neon DB e Cloudflare R2.

> [!NOTE]
> Comparado com a [análise de Fev/2026](file:///C:/Users/pepg/.gemini/antigravity/brain/f837516c-8090-48b8-b6be-0b21f09199e1/analysis_report.md), **8 dos 22 problemas foram corrigidos**. Esta reanálise lista o que persiste, o que foi corrigido, e problemas novos.

---

## ✅ Problemas Corrigidos Desde a Última Análise

| # | Problema anterior | Status |
|---|---|---|
| 2 | Hard delete de users | ✅ [deleteUser](file:///c:/Codes/Autism/autismcad/src/server/modules/users/users.service.ts#108-127) agora faz soft-delete (`ativo: false`) |
| 3 | Senhas SHA-256 sem migração | ✅ [options.ts:103-117](file:///c:/Codes/Autism/autismcad/src/server/auth/options.ts#L103-L117) migra hash legado para bcrypt no login |
| 5 | [withErrorHandling](file:///c:/Codes/Autism/autismcad/src/server/shared/http.ts#15-35) nunca utilizado | ✅ Adotado em **~30 dos 35** route handlers |
| 9 | [excluirDia](file:///c:/Codes/Autism/autismcad/src/server/modules/atendimentos/atendimentos.service.ts#280-318) faz DELETE real | ✅ [atendimentos.service.ts:306-312](file:///c:/Codes/Autism/autismcad/src/server/modules/atendimentos/atendimentos.service.ts#L306-L312) agora faz soft-delete |
| 11 | [createUser](file:///c:/Codes/Autism/autismcad/src/server/modules/users/users.service.ts#39-76) faz upsert silencioso | ✅ Agora usa `INSERT` + catch de `23505` (unique violation) com erro 409 |
| 12 | Health R2 sem auth | ✅ [r2/route.ts:24](file:///c:/Codes/Autism/autismcad/src/app/api/health/r2/route.ts#L24) exige `requireAdminGeral()` |
| 13 | Metadata padrão do template | ✅ [layout.tsx:16-17](file:///c:/Codes/Autism/autismcad/src/app/layout.tsx#L16-L17) — título "AutismCAD" e descrição adequada |
| 14 | `lang="en"` no HTML | ✅ [layout.tsx:26](file:///c:/Codes/Autism/autismcad/src/app/layout.tsx#L26) — `lang="pt-BR"` |

---

## 🔴 Problemas Críticos (Persistem)

### 1. Transações não são reais no Neon HTTP

[transaction.ts](file:///c:/Codes/Autism/autismcad/src/server/db/transaction.ts) — [runDbTransaction](file:///c:/Codes/Autism/autismcad/src/server/db/transaction.ts#20-52) faz fallback silencioso quando `DATABASE_DRIVER=neon-http` (o padrão). Operações multi-step em [salvarPaciente](file:///c:/Codes/Autism/autismcad/src/server/modules/pacientes/pacientes.service.ts#128-231), [salvarAnamneseCompleta](file:///c:/Codes/Autism/autismcad/src/server/modules/anamnese/anamnese.service.ts#229-305), [deleteTerapeuta](file:///c:/Codes/Autism/autismcad/src/server/modules/terapeutas/terapeutas.service.ts#154-197), e [salvarDocumento](file:///c:/Codes/Autism/autismcad/src/server/modules/prontuario/prontuario.service.ts#101-157) **rodam sem atomicidade**.

> [!CAUTION]
> O `env.REQUIRE_DB_TRANSACTIONS` tem default `0`. As advertências são emitidas uma única vez por operação. Na prática, **nenhuma transação é atômica** a menos que o deploy use `neon-serverless` + `REQUIRE_DB_TRANSACTIONS=1`.

**Recomendação**: Migrar para `neon-serverless` como driver padrão, ou no mínimo setar `REQUIRE_DB_TRANSACTIONS=1` em produção e tratar o erro 503 adequadamente.

---

## 🟠 Problemas de Consistência no Backend (Persistem)

### 2. Timestamps: `sql`now()`` vs `new Date()`

| Service | Usa `new Date()` | Usa `sql`now()`` |
|---------|:-:|:-:|
| [users.service.ts](file:///c:/Codes/Autism/autismcad/src/server/modules/users/users.service.ts) | ✅ L92, L116 | — |
| [terapeutas.service.ts](file:///c:/Codes/Autism/autismcad/src/server/modules/terapeutas/terapeutas.service.ts) | ✅ L113, L188, L201 | — |
| [options.ts](file:///c:/Codes/Autism/autismcad/src/server/auth/options.ts) | ✅ L110 | — |
| [pacientes.service.ts](file:///c:/Codes/Autism/autismcad/src/server/modules/pacientes/pacientes.service.ts) | — | ✅ |
| [atendimentos.service.ts](file:///c:/Codes/Autism/autismcad/src/server/modules/atendimentos/atendimentos.service.ts) | — | ✅ |
| [prontuario.service.ts](file:///c:/Codes/Autism/autismcad/src/server/modules/prontuario/prontuario.service.ts) | — | ✅ |
| [anamnese.service.ts](file:///c:/Codes/Autism/autismcad/src/server/modules/anamnese/anamnese.service.ts) | — | ✅ |

> [!WARNING]
> `new Date()` usa o relógio do servidor Node.js (potencialmente em timezone diferente do DB). `sql`now()`` usa o relógio do Postgres. Isso gera timestamps **inconsistentes entre tabelas**.

### 3. `rolePermissions.role` e `users.role` sem FK para `roles.slug`

[schema.ts:73](file:///c:/Codes/Autism/autismcad/src/server/db/schema.ts#L73) e [schema.ts:25](file:///c:/Codes/Autism/autismcad/src/server/db/schema.ts#L25) — Ambos são `varchar(32)` sem constraint de FK. Qualquer string pode ser inserida diretamente no banco. O código valida via lookup, mas inserções manuais ou seeds podem quebrar integridade.

### 4. Funções utilitárias duplicadas entre services

| Função | Cópias idênticas |
|--------|-----------------|
| [normalizeCpf](file:///c:/Codes/Autism/autismcad/src/server/modules/pacientes/pacientes.service.ts#21-24) | [pacientes.service.ts:21](file:///c:/Codes/Autism/autismcad/src/server/modules/pacientes/pacientes.service.ts#L21), [terapeutas.service.ts:13](file:///c:/Codes/Autism/autismcad/src/server/modules/terapeutas/terapeutas.service.ts#L13) |
| [normalizeOptional](file:///c:/Codes/Autism/autismcad/src/server/modules/terapeutas/terapeutas.service.ts#23-28) | [pacientes.service.ts:25](file:///c:/Codes/Autism/autismcad/src/server/modules/pacientes/pacientes.service.ts#L25), [terapeutas.service.ts:23](file:///c:/Codes/Autism/autismcad/src/server/modules/terapeutas/terapeutas.service.ts#L23) |
| [normalizeDate](file:///c:/Codes/Autism/autismcad/src/server/modules/atendimentos/atendimentos.service.ts#39-46) | [pacientes.service.ts:31](file:///c:/Codes/Autism/autismcad/src/server/modules/pacientes/pacientes.service.ts#L31) (retorna `null`), [terapeutas.service.ts:29](file:///c:/Codes/Autism/autismcad/src/server/modules/terapeutas/terapeutas.service.ts#L29) (retorna `null`), [atendimentos.service.ts:39](file:///c:/Codes/Autism/autismcad/src/server/modules/atendimentos/atendimentos.service.ts#L39) (**lança exceção**), [prontuario.service.ts:31](file:///c:/Codes/Autism/autismcad/src/server/modules/prontuario/prontuario.service.ts#L31) ([toIsoDate](file:///c:/Codes/Autism/autismcad/src/server/modules/prontuario/prontuario.service.ts#31-38), **lança exceção**) |
| [isUniqueViolation](file:///c:/Codes/Autism/autismcad/src/server/modules/anamnese/anamnese.service.ts#10-16) | [prontuario.service.ts:24](file:///c:/Codes/Autism/autismcad/src/server/modules/prontuario/prontuario.service.ts#L24), [anamnese.service.ts:10](file:///c:/Codes/Autism/autismcad/src/server/modules/anamnese/anamnese.service.ts#L10) |

> [!IMPORTANT]
> O maior risco é [normalizeDate](file:///c:/Codes/Autism/autismcad/src/server/modules/atendimentos/atendimentos.service.ts#39-46): em 2 services retorna `null` silenciosamente em data inválida, em outros 2 **lança exceção**. Um mesmo campo inválido terá comportamentos opostos dependendo do contexto.

### 5. Schema aceita `terapias` E `terapia` (singular)

[pacientes.schema.ts:36-39](file:///c:/Codes/Autism/autismcad/src/server/modules/pacientes/pacientes.schema.ts#L36-L39) — Aceita ambos os campos. O service faz merge em [normalizeTerapias](file:///c:/Codes/Autism/autismcad/src/server/modules/pacientes/pacientes.service.ts#40-55). Isso adiciona complexidade desnecessária e é herança de API antiga.

### 6. [updateRolePermissions](file:///c:/Codes/Autism/autismcad/src/server/modules/users/users.service.ts#176-205) sem transação

[users.service.ts:192-196](file:///c:/Codes/Autism/autismcad/src/server/modules/users/users.service.ts#L192-L196) — Faz `DELETE` de todas as permissões da role e depois `INSERT` das novas. Se o `INSERT` falhar, a role fica **sem nenhuma permissão**. Deveria usar [runDbTransaction](file:///c:/Codes/Autism/autismcad/src/server/db/transaction.ts#20-52).

---

## 🟡 Problemas no Frontend (Persistem / Novos)

### 7. Dark mode definido mas ineficaz

[globals.css:21-26](file:///c:/Codes/Autism/autismcad/src/app/globals.css#L21-L26) — O bloco `@media (prefers-color-scheme: dark)` define `--background: #ffffff` e `--foreground: #171717` — **idênticos à versão light**. As variáveis customizadas (`--laranja`, `--marrom`, `--verde`, etc.) não têm versão dark. Todo o layout usa `bg-white` hardcoded. O dark mode efetivamente não faz nada.

### 8. Dashboard faz queries diretas ao DB

[page.tsx](file:///c:/Codes/Autism/autismcad/src/app/(protected)/page.tsx) — A dashboard importa `db` diretamente e monta queries SQL complexas no server component (linhas 81-114), **bypassando a camada de serviço**. Isso duplica lógica (filtros de `deletedAt`, joins, etc.) e dificulta manutenção. Porém, agora usa `requirePermission` e filtra por `terapeutaId` para não-admins — o problema de segurança anterior foi **parcialmente mitigado**.

### 9. ⭐ NOVO — [ymdToday()](file:///c:/Codes/Autism/autismcad/src/app/%28protected%29/page.tsx#11-14) usa timezone do servidor

[page.tsx:12](file:///c:/Codes/Autism/autismcad/src/app/(protected)/page.tsx#L12) — `new Date().toISOString().slice(0, 10)` gera a data em **UTC**, não no timezone da clínica (ex: BRT -03:00). Um atendimento às 22h BRT seria filtrado como "amanhã" na dashboard. Mesmo problema em [ymNow()](file:///c:/Codes/Autism/autismcad/src/app/%28protected%29/page.tsx#25-31) (linha 26).

---

## 🔵 Código Morto e Limpeza

### 10. [accessHasRole](file:///c:/Codes/Autism/autismcad/src/server/auth/permissions.ts#31-36) exportado mas nunca usado

[permissions.ts:31-35](file:///c:/Codes/Autism/autismcad/src/server/auth/permissions.ts#L31-L35) — Função exportada mas **não importada em nenhum arquivo**.

### 11. Diretórios vazios remanescentes

Todos **ainda vazios** desde a última análise:

| Diretório | Status |
|-----------|--------|
| `routes/` | Vazio |
| `services/` | Vazio |
| `config/` | Vazio |
| `db/` | Vazio |
| `middlewares/` | Vazio |
| `helpers/` | Vazio |
| `legacy/` | Vazio |
| `tests/helpers/` | Vazio |

### 12. Diretórios `mysql_data/`, `nginx/`, `uploads/` sem contexto

Resíduos da stack anterior (Docker MySQL + Nginx + uploads locais), não mais utilizados.

### 13. ⭐ NOVO — Schema `withTimezone: false` em todas as timestamps

[schema.ts](file:///c:/Codes/Autism/autismcad/src/server/db/schema.ts) — Todas as 18 colunas de timestamp usam `withTimezone: false`. Isso armazena timestamps **sem informação de timezone**, depende do timezone do servidor para interpretação. Se o Neon DB rodar em UTC (padrão) e o app inserir `new Date()` em BRT, os valores ficarão com offset errado.

### 14. ⭐ NOVO — `deleteTerapeuta` faz hard-delete

[terapeutas.service.ts:190](file:///c:/Codes/Autism/autismcad/src/server/modules/terapeutas/terapeutas.service.ts#L190) — `tx.delete(terapeutas)` faz DELETE permanente. Diferente de pacientes e atendimentos que fazem soft-delete. Se precisar restaurar um terapeuta deletado, é impossível. A tabela `terapeutas` nem tem coluna `deletedAt`.

---

## 📋 Resumo Comparativo

| Severidade | Qtd (Fev) | Qtd (Mar) | Detalhes |
|-----------|:-:|:-:|---|
| ✅ Corrigido | — | 8 | deleteUser, excluirDia, password migration, withErrorHandling, upsert, R2 auth, metadata, lang |
| 🔴 Crítico | 3 | 1 | Transações falsas (persiste) |
| 🟠 Backend | 9 | 5 | Timestamps, FK roles, duplicação, schema terapia, updateRolePermissions |
| 🟡 Frontend | 6 | 3 | Dark mode, dashboard queries diretas, timezone do servidor |
| 🔵 Limpeza | 4 | 5 | accessHasRole, dirs vazios, dirs resíduo, timestamp sem timezone, hard-delete terapeuta |

> [!TIP]
> **Prioridades recomendadas**:
> 1. Migrar para `neon-serverless` ou ativar `REQUIRE_DB_TRANSACTIONS=1` em produção
> 2. Padronizar timestamps para `sql`now()`` em todos os services
> 3. Extrair funções utilitárias (`normalizeCpf`, `normalizeDate`, etc.) para `src/server/shared/normalize.ts`
> 4. Adicionar `deletedAt` ao schema de `terapeutas` e fazer soft-delete
> 5. Limpar diretórios vazios e código morto
