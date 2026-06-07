# Auditoria Técnica — autismcad

**Data**: 2026-04-30  
**Revisão**: 2026-05-15 (incorpora contra-opinião técnica com verificação no código-fonte)  
**Escopo**: Next.js 16 (App Router) + Drizzle ORM + Neon + NextAuth (JWT) + Cloudflare R2  
**Método**: análise estática multi-agente sobre `src/server`, `src/app`, `src/components`, `src/lib`, validação manual de cada achado para eliminar falsos positivos.

> Falsos positivos descartados após verificação manual estão no final do documento.

---

## 🔴 CRÍTICO

### C1. Frontend pode persistir datas inválidas no banco — schemas de pacientes/profissionais não validam formato ISO
- **Arquivo**: `src/server/modules/pacientes/pacientes.schema.ts:11,28,37`; `src/server/modules/profissionais/profissionais.schema.ts:7-15,34`
- **Achado**: `requiredDate = z.string().trim().min(1)` e `nullableDate = z.string().trim().optional().nullable()` — nenhum dos dois valida formato `YYYY-MM-DD` nem datas existentes. Strings como `"abc"`, `"2025-13-40"`, `"2050-02-30"` passam pelo zod e tentam ir para colunas `date` do Postgres. O Postgres rejeita, mas com erro genérico de driver, sem feedback de campo no formulário.
- **Impacto**: UX ruim (erro 500 em vez de erro de campo), risco de bugs lógicos quando middleware de normalização não roda, divergência com `normalizeDateOnlyStrict` usado em atendimentos (que valida).
- **Correção**: trocar `requiredDate` por `z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => !Number.isNaN(Date.parse(v)))`. Reaproveitar o helper `normalizeDateOnlyStrict`.

### C2. CPF único parcial ignora a flag `ativo` — duplicidade real possível
- **Arquivo**: `src/server/db/schema.ts:137-139,243-245`
- **Achado**: `uk_pacientes_cpf_ativo` e `uk_terapeutas_cpf_ativo` filtram apenas por `deletedAt IS NULL`, mas não consideram `ativo`. Um paciente "arquivado" (`ativo=false`, `deletedAt=NULL`) bloqueia a criação de outro com o mesmo CPF, ou — pior — se a regra de negócio interpreta arquivado como "removido lógico", há ambiguidade entre o índice e o serviço.
- **Impacto**: ou colisão indevida ao reativar, ou cadastros duplicados se o serviço usar `ativo` para filtrar. Estado de dado ambíguo.
- **Correção**: definir contrato único: ou a unicidade considera `ativo` (`WHERE deletedAt IS NULL AND ativo`), ou a flag `ativo` é eliminada e fica só soft-delete. Migration + ajuste em services.

### C3. Variáveis R2 e `CRON_SECRET` marcadas como `.optional()` em `env.ts`
- **Arquivo**: `src/lib/env.ts:21-32`
- **Achado**: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` e `CRON_SECRET` são `.optional()`. Em produção, a app boota sem essas variáveis e quebra apenas no primeiro upload com erro 500 obscuro vindo do `assertR2Config()`. O cron de cleanup falha em runtime com `CRON_NOT_CONFIGURED`.
- **Impacto**: deploy em produção sobe sem capacidade de upload e ninguém percebe até alguém tentar enviar laudo. Falha tardia em sistema clínico.
- **Correção**: usar `superRefine` no `envSchema` para exigir esses campos quando `NODE_ENV === "production"` (mesmo padrão já aplicado a `AUTH_SECRET` na linha 42-44).

---

## 🟠 ALTO

### A1. Sem `middleware.ts` — proteção de rota só ocorre dentro do RSC
- **Arquivo**: ausência de `src/middleware.ts` ou `middleware.ts` na raiz; proteção em `src/app/(protected)/layout.tsx:22-25`
- **Achado**: rotas protegidas dependem do `getAuthSession()` chamado no layout. Não há barreira de Edge antes do render. Rotas em `(protected)` agrupam isso, mas `/impressao/*` está fora desse grupo e cada page chama `requirePermission()` manualmente — risco de uma nova rota ser criada sem essa chamada.
- **Impacto**: superfície grande para esquecer auth em uma rota nova. Sem rate-limit/CSRF central.
- **Correção**: adicionar `middleware.ts` com `withAuth` do `next-auth/middleware`, com matcher cobrindo `/((?!login|api/auth|_next|favicon|public).*)`.

### A2. Token JWT com `roleSyncedAt` de 5 min e sem revogação imediata
- **Arquivo**: `src/server/auth/options.ts:36-63,68-69`
- **Achado**: `TOKEN_ROLE_SYNC_INTERVAL_SECONDS = 300`. Quando admin desativa um usuário ou muda role, a sessão atual segue válida por até 5 minutos. `maxAge` 8h sem rotação e sem blacklist. `requireRole` baseado no JWT confia na role antiga até o refresh.
- **Impacto**: profissional desligado mantém acesso a prontuário por até 5 min. Em contexto LGPD/clínico isso é problemático.
- **Correção**:
  1. Adicionar coluna `users.tokenVersion` (int) e gravar `tokenVersion` no JWT no callback `jwt`.
  2. Em `refreshTokenRole`, comparar contra DB e propagar sinal de logout quando muda.
  3. Reduzir `TOKEN_ROLE_SYNC_INTERVAL_SECONDS` para 60 e bumpar `tokenVersion` em mudanças sensíveis.

### A3. Soft-delete de profissional não cancela atendimentos futuros *(redação revisada)*
- **Arquivo**: `src/server/db/schema.ts:266,393`; fluxo de delete em `profissionais.service.ts`
- **Achado**: a FK `onDelete: "restrict"` só impede hard-delete. Soft-delete escreve `deletedAt` mas atendimentos e evoluções continuam apontando para o profissional "removido". Algumas listagens usam `leftJoin` sem filtrar `terapeutas.deletedAt` (ex: `atendimentos.service.ts:330`, `relatorios.service.ts:260,352,819`, `dashboard.service.ts:61,78`, `prontuario.service.ts:355,446`), o que pode resultar em `profissionalNome = null` para registros antigos nessas queries — mas não é universal, pois os `innerJoin` em outras queries simplesmente omitem o registro.
- **Impacto**: relatórios/agenda com nome de profissional faltando em alguns contextos; atendimentos futuros não são cancelados automaticamente ao desligar profissional.
- **Correção**: ao soft-deletar profissional, ou (a) bloquear se existem atendimentos futuros não deletados, ou (b) cancelar/soft-deletar esses atendimentos junto, dentro da mesma transação.

### A4. Audit log não bloqueia login mesmo em falha — possível silenciamento de brute-force
- **Arquivo**: `src/server/auth/options.ts:22-34,30-33`
- **Achado**: `safeRecordLoginAttempt` engole qualquer erro com `console.error`. Não há fallback para fila ou alerta. Um problema de DB faz o sistema continuar autenticando sem rastro.
- **Impacto**: compliance e detecção de ataques fica cega em períodos de instabilidade.
- **Correção**: encaminhar erro para um sink (Sentry/DataDog) e/ou um buffer em memória com flush periódico. Manter o "best effort" no caminho feliz.

### A5. Lock de versão ausente no UPDATE de prontuário (existe só em INSERT)
- **Arquivo**: `src/server/modules/prontuario/prontuario.service.ts` (caminho de update no `salvarDocumento`)
- **Achado**: `acquireProntuarioDocumentVersionLock` é chamado só no insert. O update concorrente em `(pacienteId, tipo, version)` confia só no unique constraint, mas pode causar lost update do `payload`/`status` em concorrência.
- **Impacto**: dois profissionais editando o mesmo plano de ensino — o último escreve por cima, sem mesclar.
- **Correção**: ou aplicar o mesmo `pg_advisory_xact_lock` no UPDATE, ou incluir `where version = :expectedVersion` (optimistic lock) e devolver erro `409 CONFLICT` se 0 linhas atualizadas.

### A6. TOCTOU em `assertPacienteAccess` para RESPONSAVEL/PROFISSIONAL
- **Arquivo**: `src/server/auth/paciente-access.ts:71-99`
- **Achado**: a checagem de vínculo (`profissionalAtendePaciente` ou `getPacientesVinculadosByUserId`) é feita antes da operação, fora de transação. Entre check e mutação, um admin pode revogar o vínculo e a operação ainda completa.
- **Impacto**: um terapeuta desvinculado pode finalizar uma evolução iniciada no momento exato da revogação.
- **Correção**: re-checar o vínculo dentro da mesma transação onde a mutação acontece (passar `tx` para uma versão do `assertPacienteAccess`), ou usar `SELECT ... FOR SHARE` em `userPacienteVinculos`/`atendimentos` antes de gravar.

### A7. Erros de validação de data não chegam por campo no formulário
- **Arquivo**: `actionErrorResult` consumido pelos forms; ligado a C1.
- **Achado**: o `react-hook-form` não consegue mostrar erro de campo se o backend retornar 500 — a action retorna `actionErrorResult` genérico.
- **Correção**: junto com C1 (regex+refine), garantir que `actionErrorResult` mapeie `INVALID_DATE`/`INVALID_INPUT` por campo (zod já entrega `error.issues[].path`).

### A8. Soft-delete de atendimento deixa evolução vinculada com `statusRepasse` inconsistente *(redação revisada)*
- **Arquivo**: `src/server/modules/atendimentos/atendimentos.service.ts:406-436`; `src/server/db/schema.ts:394-396`
- **Achado**: ao soft-deletar um atendimento, a evolução vinculada **não perde** o `atendimentoId` — o `onDelete: "set null"` no schema (linha 395) só dispara em **hard-delete**, não em soft-delete. No fluxo normal (soft-delete), o `atendimentoId` permanece intacto na evolução, mas o atendimento está logicamente excluído. O `statusRepasse` do atendimento (que pode ser `"Concluido"`) não é recalculado/limpo na transação de soft-delete. **O problema real é a ausência de política explícita para tratar evolução/repasse quando o atendimento é excluído logicamente.**
- **Impacto**: relatórios financeiros/repasse podem mostrar `statusRepasse = "Concluido"` em atendimento soft-deletado.
- **Correção**: ao soft-delete do atendimento, ou (a) soft-delete em cascata da evolução, ou (b) recalcular `statusRepasse` para `"Pendente"` na transação de delete.

---

## 🟡 MÉDIO

### M1. CEP — validação tardia no service, schema permissivo *(redação revisada)*
- **Arquivo**: `src/server/modules/profissionais/profissionais.schema.ts:42` (`max(12)`) vs `src/server/db/schema.ts:228` (`varchar(8)`)
- **Achado**: o schema Zod aceita até 12 caracteres, mas o **service normaliza** via `normalizeCep()` em `profissionais.service.ts:20-24`, que extrai somente dígitos e trunca para 8 (`value.replace(/\D/g, "").slice(0, 8)`). Portanto, truncamento direto pelo Postgres é improvável no fluxo normal. No entanto, a validação ocorre tarde (no service, não no schema), o que é frágil: qualquer novo caminho que grave diretamente sem passar pelo service pode causar erro.
- **Impacto**: risco de validação tardia/fraca, não de truncamento direto provável no fluxo atual.
- **Correção**: schema → `z.string().trim().regex(/^\d{8}$/).optional().nullable()` e/ou `transform` para extrair dígitos, alinhando schema com banco.

### M2. `email` com `.email().max(120).optional().nullable()` falha para `""`
- **Arquivo**: `src/server/modules/pacientes/pacientes.schema.ts:30`; idem profissionais.
- **Impacto**: form envia `""` para campo opcional → 400.
- **Correção**: `z.string().trim().email().optional().or(z.literal("")).transform(v => v || null)`.

### M3. `looksLikeR2Key` rejeita URLs http(s), mas leitura legacy mantém compatibilidade *(redação revisada)*
- **Arquivo**: `src/app/(protected)/pacientes/paciente.actions.ts:223-233,278-280`
- **Achado**: `looksLikeR2Key` (linha 228) **rejeita** qualquer string que comece com `http(s)://`, impedindo que URLs completas sejam persistidas como novas keys via o fluxo de `commitArquivoPacienteAction`. O que existe em `obterArquivoPacienteReadUrlAction` (linha 278-280) é **compatibilidade de leitura** para URLs já persistidas em registros antigos — se a coluna contém uma URL legacy, ela é retornada diretamente em vez de gerar um signed URL. **Não há risco de persistir URLs pre-signed novas por esse caminho.**
- **Impacto**: débito técnico — URLs legacy no banco continuam sendo servidas diretamente, potencialmente com TTL expirado se forem pre-signed antigas.
- **Correção**: migrar dados antigos para keys puras; remover o atalho `if (/^https?:\/\//i.test(key))` após migração. Severidade reduzida para débito técnico.

### M4. `next-auth.d.ts` não inclui `roleSyncedAt` no `User` (apenas no `JWT`); id como `string`
- **Arquivo**: `src/types/next-auth.d.ts`
- **Impacto**: pequeno débito de tipagem; `Session.user.id` é `string` e o resto do sistema espera `number`.
- **Correção**: padronizar — `Session.user.id` como `number` e converter no callback `session`.

### M5. Anamnese sem advisory lock (apenas retry sobre unique)
- **Arquivo**: `src/server/modules/anamnese/anamnese.service.ts:194-269`
- **Impacto**: sob concorrência, várias 409s antes de sucesso. Atendimentos já fazem certo com `pg_advisory_xact_lock`.
- **Correção**: aplicar lock por paciente antes de calcular `nextVersion`.

### M6. `userPacienteVinculos` cascade no delete do paciente — fraco no fluxo atual *(redação revisada)*
- **Arquivo**: `src/server/db/schema.ts:162-181`; `pacientes.service.ts`
- **Achado**: o FK cascade (`onDelete: "cascade"`) em `userPacienteVinculos` dispara ao deletar paciente. Porém, o sistema usa **soft-delete** de paciente (`softDeletePaciente` em `pacientes.service.ts:386`), então a cascata **não dispara no caminho normal**. O gap de auditoria existe em tese (se um hard-delete manual ocorrer, os vínculos somem sem rastro), mas no fluxo de aplicação o risco é baixo.
- **Impacto**: gap de auditoria teórico — relevante apenas se hard-delete ocorrer fora do fluxo normal.
- **Correção**: ou trocar para `restrict` e exigir desligamento explícito antes do delete, ou registrar audit no `softDeletePaciente`. Prioridade reduzida dado o soft-delete.

### M7. Rota `/api/cron/r2-temp-cleanup` aceita `GET` e `POST`
- **Arquivo**: `src/app/api/cron/r2-temp-cleanup/route.ts:40-41`
- **Impacto**: pequeno — `GET` com efeito colateral viola HTTP semantics e facilita disparo via `<img>`/preconnect; mitigado pelo Bearer secret.
- **Correção**: deixar só `POST`.

### M8. Páginas de impressão fora do `(protected)` dependem de chamada manual
- **Arquivo**: `src/app/impressao/devolutiva/page.tsx`, `src/app/impressao/plano-ensino/page.tsx`
- **Impacto**: hoje OK porque cada `page.tsx` chama `requirePermission()`, mas é uma armadilha — uma futura página esquecer essa chamada vaza dados.
- **Correção**: mover para dentro de `(protected)/impressao` ou criar um `layout.tsx` em `/impressao` que faça o gate.

### M9. Sem `loading.tsx`/Suspense em páginas pesadas
- **Arquivo**: `src/app/(protected)/relatorios/**`, `pacientes/[id]/page.tsx`, `consultas/page.tsx`
- **Impacto**: latência percebida alta no carregamento, sem skeleton.
- **Correção**: adicionar `loading.tsx` por rota e/ou Suspense em sub-componentes pesados.

### M10. Validação de uploads server-side só após o PUT no R2
- **Arquivo**: presign em `paciente.actions.ts:289-312`
- **Impacto**: o PUT direto ao R2 já está vinculado ao `ContentType` no presign, mas a action commit só verifica existência via `objectExistsInR2`. Não há HEAD para confirmar `Content-Type` e `Content-Length` reais.
- **Correção**: no commit, fazer HEAD na key e validar Content-Type/Length antes de gravar a chave no DB.

### M11. Convenio/Especialidade/Presença/Turno — validação no schema vs. service *(rebaixado de C4)*
- **Arquivo**: `src/server/modules/pacientes/pacientes.schema.ts:3-8,29`; `src/server/modules/profissionais/profissionais.schema.ts:4,43`; `src/server/modules/atendimentos/atendimentos.schema.ts:3-8,41,44`
- **Achado**: existem conjuntos canônicos (`conveniosPermitidos`, `especialidadesPermitidas`, `presencasPermitidas`, `turnosPermitidos`) mas a validação Zod aceita `z.string().trim()`. No entanto, **os services compensam em boa parte**:
  - **Pacientes**: `salvarPaciente` valida `conveniosPermitidos` e rejeita com `AppError("Convenio invalido", 400)` em `pacientes.service.ts:287-289`.
  - **Profissionais**: `normalizeEspecialidade` valida `especialidadesPermitidas` e rejeita com `AppError("Especialidade invalida", 400)` em `profissionais.service.ts:26-33`.
  - **Atendimentos**: `normalizeTurno` e `normalizePresenca` normalizam para defaults válidos em `atendimentos.service.ts:35-41`.
- **Impacto**: a validação existe mas ocorre tarde (no service, não no schema). Não é um risco crítico de "dados sujos" dado que os services cobrem, mas viola defesa em profundidade e pode confundir com erros genéricos em vez de erros de campo.
- **Correção**: trocar para `z.enum([...conveniosPermitidos])` etc. no schema para erros de campo mais claros e defesa em profundidade. **Severidade rebaixada de CRÍTICO para MÉDIO.**

---

## 🟢 BAIXO

### B1. Acessibilidade: inputs de upload sem `<label>` associado *(redação revisada)*
- **Arquivo**: `paciente-form.client.tsx` (linhas 580-646), `configuracoes/permissoes.client.tsx`
- **Achado**: a maioria dos inputs no `paciente-form.client.tsx` **está dentro de `<label>` wrapper** (padrão `<label className="flex flex-col gap-2"><span>...</span><input .../></label>`), o que cria associação acessível implícita mesmo sem `id`/`htmlFor`. No entanto, **os inputs de upload de arquivo** (foto, laudo, documento — linhas 580-646) estão dentro de `<div>`, não de `<label>`, e usam `<span>` como rótulo sem associação programática.
- **Impacto**: leitores de tela não associam o rótulo ao input de upload. Os demais campos do formulário estão acessíveis.
- **Correção**: trocar os `<div>` wrapper dos uploads por `<label>`, ou adicionar `id`/`htmlFor` explícito nesses campos específicos.

### B2. Mensagem de erro genérica em login (sem rate limit visível)
- **Arquivo**: `src/app/login/page.tsx`
- OK do ponto de vista de não enumerar usuários, mas sem rate limit explícito (`access_logs` registra mas não bloqueia).

### B3. `ativo` em pacientes aceita union string|number|boolean
- **Arquivo**: `src/server/modules/pacientes/pacientes.schema.ts:41`
- Funciona, mas vira problema quando alguém adicionar um caminho novo.

### B4. Truncamento silencioso em `access_logs.user_agent` (varchar 512)
- **Arquivo**: schema + service.
- Logar uma flag `userAgentTruncated` ou aumentar para `text`.

### B5. Atendimentos: zod aceita `data` qualquer string `min(10).max(10)`
- Mitigado pelo service `normalizeDateOnlyStrict`, mas defesa em profundidade ausente — adicionar regex no schema.

### B6. Profissional: schema permissivo de `especialidade` quando há set canônico
- Coberto por M11 (antigo C4).

### B7. N+1 latente em dashboard com muitos profissionais distintos
- Hoje resolvido por LEFT JOIN; só virar problema com volume.

---

## ✅ Falsos positivos descartados (após validação manual)

- **Cleanup R2 deletando arquivo ativo**: o `cleanupTempObjectsInR2` só varre `pacientes/temp/`, e a promoção move o arquivo para `pacientes/{id}/...` (fora do prefixo).
- **Path traversal/cross-paciente em commit**: `paciente.actions.ts:333-340` valida que a key começa exatamente com o prefixo `pacientes/temp/${idNum}/...` ou `pacientes/${idNum}/...`. Mitigado.
- **Admin bypass em `assertHasPermission` sem checar `ativo`**: `loadUserAccess` já restringe a `ativo=true AND deletedAt IS NULL`, então `access.exists=true` implica usuário ativo.
- **Relatório evolutivo permitindo profissional arbitrário**: `relatorios.service.ts:116-119` força `profissionalId` ao do próprio user quando role é PROFISSIONAL.
- **JWT sem revogação no logout** como achado isolado: comportamento padrão de NextAuth `strategy: "jwt"`. Tratado como parte do A2 com proposta concreta de `tokenVersion`.

---

## 📋 Plano priorizado de correção

### Sprint 1 — Crítico (blocker para próxima release)
1. **C1+A7**: regex+refine em `requiredDate`/`nullableDate` e mapear erros zod por campo nas server actions.
2. **C2**: migration alinhando unicidade de CPF — definir contrato (`ativo` participa do índice OU eliminar `ativo` redundante).
3. **C3**: `superRefine` em `env.ts` exigindo R2_* e CRON_SECRET em produção.

### Sprint 2 — Alto (segurança e integridade)
4. **A1**: criar `middleware.ts` com `withAuth` cobrindo todas as rotas exceto `login`/`api/auth`.
5. **A2**: introduzir `users.tokenVersion`; bumpar em desativação/role-change; comparar no `jwt` callback.
6. **A3**: bloquear/cancelar atendimentos futuros antes de soft-deletar profissional, em transação.
7. **A5**: optimistic lock no UPDATE de prontuário (`where version = :expected`).
8. **A6**: re-validar vínculo paciente↔user dentro da transação de mutação.
9. **A8**: ao soft-delete de atendimento, definir política para evolução vinculada e recalcular `statusRepasse`.

### Sprint 3 — Médio (qualidade e observabilidade)
10. **A4**: encaminhar falha de `recordLoginAttemptAccess` para sink externo.
11. **M1**: alinhar CEP (`regex(/^\d{8}$/)`) no schema.
12. **M2**: tratar `""` em emails opcionais.
13. **M3**: migrar URLs persistidas → keys puras; remover atalho `http(s)://` após migração.
14. **M5**: advisory lock também em anamnese.
15. **M6**: avaliar necessidade de audit ao soft-delete do paciente (baixa prioridade dado soft-delete).
16. **M7**: deixar `cron/r2-temp-cleanup` só com `POST`.
17. **M8**: gate em `/impressao/layout.tsx`.
18. **M9**: `loading.tsx` em rotas pesadas.
19. **M10**: HEAD no R2 antes de gravar a key no DB.
20. **M11**: trocar `z.string()` por `z.enum([...Set])` para campos canônicos (defesa em profundidade).

### Sprint 4 — Baixo (UX e débito técnico)
21. **B1**: acessibilidade de labels nos inputs de upload.
22. **B2**: rate limit explícito por IP/email no login.
23. **B4**: aumentar `user_agent` para `text` ou expor flag de truncamento.
24. **M4/B3/B5/B6**: hardening incremental de tipos.

---

## 📝 Registro de revisão

### Alterações aplicadas em 2026-05-15

| Item | Alteração | Motivo |
|------|-----------|--------|
| **C4 → M11** | Rebaixado de CRÍTICO para MÉDIO | Services compensam: `pacientes.service` valida `conveniosPermitidos`, `profissionais.service` valida `especialidadesPermitidas`, `atendimentos.service` normaliza turno/presença. Risco real é defesa em profundidade, não dados sujos. |
| **M1** | Redação revisada | Service `normalizeCep()` normaliza para 8 dígitos antes de gravar. Risco é validação tardia, não truncamento direto. |
| **M3** | Redação revisada | `looksLikeR2Key` **rejeita** URLs http(s). O atalho na leitura é compatibilidade legacy, não persistência nova. |
| **A3** | Redação revisada | "nome NULL" não é universal — depende de `leftJoin` vs `innerJoin` em cada query específica. Listadas as queries afetadas. |
| **A8** | Redação revisada | `onDelete: "set null"` só dispara em hard-delete. No soft-delete (fluxo normal), `atendimentoId` permanece intacto. Problema real é ausência de política para evolução/repasse. |
| **M6** | Redação revisada | Soft-delete de paciente é o fluxo normal; cascade não dispara. Gap teórico, prioridade reduzida. |
| **B1** | Redação revisada | Maioria dos inputs usa `<label>` wrapper (associação implícita). Problema restrito aos inputs de upload de arquivo. |

---

## Resumo executivo

O projeto tem fundamentos sólidos: advisory locks em atendimentos, soft-delete consistente em pacientes, separação de schema/service, RBAC com aliases, validação de prefix em uploads R2, e **validação de domínio nos services** (convênios, especialidades, turno, presença).

Os pontos críticos remanescentes são da família **"validação fraca na borda do schema"**: datas sem regex (C1), envs opcionais em produção (C3), CPF unique parcial ignorando `ativo` (C2). Esses três itens, mais o middleware faltando (A1) e o `tokenVersion` (A2), mudam o nível de robustez do sistema e devem ser endereçados antes da próxima feature.

A validação de campos canônicos (antigo C4, agora M11) é um ponto de melhoria para defesa em profundidade, mas os services já garantem integridade no fluxo atual.
