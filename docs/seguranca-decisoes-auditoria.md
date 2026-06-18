# Decisões de segurança aceitas (auditoria)

Registro das decisões explícitas tomadas sobre achados da auditoria que **não**
foram corrigidos por mudança de código, com a justificativa e o gatilho de revisão.
Referência: `relatorios/auditoria-2026-06-16-115803.md`.

## Achado 80 — Refresh token mobile stateless (30 dias)

**Status:** aceito (MVP).

Os tokens Bearer do mobile são JWT HS256 sem store de refresh
(`apps/web/src/server/auth/api-token.ts`). Simples e serverless-safe; o custo é não
poder revogar um token antes de expirar (access 1h, refresh 30d).

**Revisar quando:** houver requisito de logout remoto/revogação imediata, ou
incidente de credencial vazada. A correção exige um store de refresh tokens
(rotação + revogação) — mudança de infraestrutura, fora do escopo atual.

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
