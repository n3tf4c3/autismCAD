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

**Status:** aceito, com revisão programada.

As 16 vulnerabilidades (1 baixa, 11 moderadas, 4 altas) estão **todas em cadeias de
tooling de build/dev**, não em dependências de runtime do app publicado:

- `esbuild` / `@esbuild-kit/*` via `drizzle-kit`;
- `@babel/core`, `js-yaml`;
- `uuid` (v3/v5/v6) via `xcode` → `@expo/*` CLI.

Não são exploráveis no runtime da aplicação implantada (web server / app nativo). As
correções dependem de releases upstream de Expo SDK e drizzle-kit.

**Decisão:** não rodar `npm audit fix --force` (downgrade/breaking nas cadeias Expo)
nesta branch de lançamento. Atualizar por caminho controlado — bump de Expo
SDK/drizzle-kit fora da branch de release, com `npm run build` e teste em device.

**Revisar quando:** próximo bump de Expo SDK, ou se alguma cadeia vulnerável passar a
fazer parte do runtime.
