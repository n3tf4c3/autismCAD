# Decisões de segurança aceitas (auditoria)

Registro das decisões explícitas tomadas sobre achados da auditoria que **não**
foram corrigidos por mudança de código, com a justificativa e o gatilho de revisão.
Referência: `relatorios/auditoria-2026-06-16-115803.md`.

## Achado 80 — Refresh token mobile stateless (30 dias)

**Status:** RESOLVIDO em 2026-07-08.

Deixou de ser uma decisão aceita: os refresh tokens passaram a ser rastreados
server-side na tabela `api_refresh_tokens` (migration 0009). Cada refresh token
carrega um `jti` registrado no store (`apps/web/src/server/auth/refresh-token-store.ts`);
o refresh **rotaciona** (revoga o token usado e registra o novo, num UPDATE atômico
que impede corrida) e o novo `POST /api/v1/auth/logout` revoga o token apresentado.
Tokens legados sem `jti` são rejeitados no refresh (exigem novo login). A exposição
máxima de um token vazado caiu de 30 dias para 1 h (TTL do access token). A revogação
em massa por troca de senha (`token_version`, achado 103) permanece como segunda camada.

## Achado 81 — CORS da API v1 com origem coringa por padrão

**Status:** decisão explícita.

`apps/web/src/proxy.ts` aplica CORS só em `/api/v1/*` e usa `*` por padrão
(`API_V1_CORS_ORIGIN`). A autenticação é **Bearer, sem cookies**, então não há
superfície de CSRF baseada em cookie; o app Expo nativo nem envia `Origin`. O
coringa serve Expo web/dev e tooling.

**Como restringir:** definir `API_V1_CORS_ORIGIN` com a origem desejada em produção.

**Revisar quando:** a API v1 passar a aceitar autenticação por cookie/sessão, ou
expor endpoints sensíveis a navegador.

## Achado 99 — `npm audit` com vulnerabilidades em tooling

**Status:** RESOLVIDO em 2026-07-08 (junto com o achado 119, que registrava o mesmo
quadro reauditado). `npm audit` = **0 vulnerabilidades**.

Resolvido sem bump de Expo SDK (o projeto já estava no SDK 56 e nem o 57 zeraria a
cadeia do `uuid`, pois `xcode@3.0.1` upstream ainda pina `uuid ^7`). Caminho adotado:
`overrides` no `package.json` root — `@babel/core ^7.29.7`, `js-yaml ^4.3.0` e
`uuid ^11.1.1` (o `xcode` só usa `uuid.v4()`, compatível com v11) — e lockfile
regenerado do zero com `--legacy-peer-deps` (o peer `@babel/core: "*"` do
`react-native-worklets` resolve para o Babel 8 recém-publicado e trava ERESOLVE em
qualquer re-resolução fresca; `npm ci`/install a partir do lock não são afetados).
`eslint-plugin-react-hooks` pinado em `7.0.1` (a 7.1.1 ativa regras novas como erro
em padrões pré-existentes das telas mobile — tratar em item próprio, fora deste).

**Revisar quando:** próximo bump de Expo SDK (remover os overrides que o upstream
absorver e reavaliar o pin do eslint-plugin-react-hooks).

## Achado 133 — Política de degradação do rate limit sob falha do store

**Status:** decisão explícita, registrada em 2026-08-04 (quesito D4 da
`verificacao-seguranca`).

O rate limit de login (achado 60) conta falhas recentes em `access_logs`
(`apps/web/src/server/modules/access-logs/access-logs.service.ts`). A política por
operação é:

| Operação | Sob falha do store | Por quê |
|---|---|---|
| **Login** (web e mobile) | **degrada** (fail-open, não bloqueia) | negar login com o banco meio no ar tira a clínica do ar inteira; o custo de um brute force durante a janela é menor que o de indisponibilidade total |
| Demais operações sensíveis | **negam** | nenhuma existe hoje: não há reset de senha, exclusão de conta self-service nem validação de compra. Quando existirem, entram aqui como fail-closed |

**Controle compensatório.** O quesito D4 pede compensação que não dependa do store
externo. Aqui **o store é o próprio Postgres da aplicação**, não um Redis à parte: se ele
cai, o `select` do usuário em `verifyCredentials` já falha e ninguém entra. A janela real
de fail-open é estreita — erro específico da consulta de agregação com o banco no ar — e
não há caminho em que o atacante consiga derrubar só o contador mantendo o login de pé.

**Revisar quando:** (a) o rate limit migrar para store externo (Upstash/Redis) — aí o
fail-open passa a ser explorável isoladamente e exige lockout por conta persistido em
`users`; ou (b) surgir operação sensível nova (reset de senha, exclusão self-service,
billing), que nasce fail-closed.
