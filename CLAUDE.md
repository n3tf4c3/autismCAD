# CLAUDE.md — AutismCAD

> Diretrizes comportamentais gerais vêm de `C:\Codes\CLAUDE.md` (carregado junto).
> Este arquivo traz só o contexto específico do projeto.

## O que é

Gestão de clínica para pacientes TEA (Clínica Girassóis): pacientes,
profissionais, agenda/consultas, prontuário (evoluções, plano de ensino,
anamnese), relatórios com exportação PDF/DOCX, RBAC com logs de acesso, e app
mobile de apoio consumindo `/api/v1`.

## Stack

- **Monorepo npm workspaces + Turborepo**: `apps/web`, `apps/mobile`,
  `packages/db`, `packages/validators`, `packages/shared`.
- **Web** (`apps/web`): Next.js 16 (App Router) · React 19 · NextAuth v4
  (Credentials/JWT) · Drizzle ORM.
- **Banco**: PostgreSQL com `DATABASE_DRIVER=neon-serverless` e
  `REQUIRE_DB_TRANSACTIONS=1` — **este projeto TEM transação interativa real**
  (diferente dos projetos em `neon-http`). Preferir `DATABASE_URL_UNPOOLED`
  (endpoint sem `-pooler`).
- **Mobile** (`apps/mobile`): Expo/React Native + Expo Router, Bearer JWT.
- **Arquivos**: Cloudflare R2 (S3 SDK). Em produção, R2 e `CRON_SECRET` são
  obrigatórios em runtime.
- **Validação/contratos**: Zod compartilhado em `@autismcad/validators` — não
  redeclarar limites em web/mobile.

## Comandos (da raiz; turbo por baixo)

```bash
npm run typecheck && npm run lint && npm test
npm run build                      # build dos workspaces
npm run dev                        # turbo run dev
npm run db:generate | db:migrate | db:check | db:studio
npm run db:seed:admin -w @autismcad/web
```

## Convenções e invariantes

- **`db:push` é DESABILITADO** (achado 105): cria schema sem as funções/triggers
  das migrations. Fluxo canônico é `db:generate` + `db:migrate`; sandbox
  descartável só com `DB_PUSH_SANDBOX=1`.
- **`as never` é proibido** em `apps/web/src` — o CI tem guardrail que falha o
  build se encontrar.
- RBAC: toda action/rota valida permissão no backend; a matriz de permissões da
  UI espelha o backend. Logs de acesso nas operações sensíveis.
- Numeração de achados de auditoria é contínua — ledger em
  `docs/auditoria-achados.md`; decisões de segurança em
  `docs/seguranca-decisoes-auditoria.md`.
- Relatórios de auditoria ficam em `relatorios/` (gitignored); skills
  `/auditoria-tecnica` e `/resolver-auditoria` definem o processo.
