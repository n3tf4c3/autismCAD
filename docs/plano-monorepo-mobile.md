# Plano: Migração para Monorepo + Viabilidade de App Mobile

Data: 2026-06-11

## Status em 2026-06-16

Este documento e historico e descreve o plano original. O estado atual ja implementa o monorepo e o MVP mobile:

- `apps/web`: app Next.js atual.
- `apps/mobile`: app Expo com telas de login, agenda, evolucao, pacientes, devolutiva e consentimento.
- `packages/db`: schema Drizzle, migrations e comandos `db:*`.
- `packages/validators`: contratos Zod compartilhados.
- `packages/shared`: utilidades puras compartilhadas.
- API mobile versionada em `apps/web/src/app/api/v1/*`, com auth Bearer por login/refresh.

As secoes abaixo devem ser lidas como registro de decisao, nao como checklist pendente.

## 1. Diagnóstico do estado atual

O projeto é um app único Next.js 16 (App Router) com:

- **Backend bem camadizado**: lógica de negócio em `src/server/modules/*` (services + schemas Zod), separada das Server Actions que ficam junto às páginas em `src/app/(protected)/*/*.actions.ts`. Essa separação é o maior facilitador da migração — os services não conhecem Next.js.
- **Banco**: Drizzle ORM + Neon Postgres (`src/server/db/schema.ts`, migrations em `src/server/db/migrations`).
- **Auth**: NextAuth v4 com CredentialsProvider e estratégia JWT, mas **transportada por cookie de sessão** — funciona só para browser.
- **Storage**: Cloudflare R2 com URLs assinadas (`src/server/storage/r2.ts`).
- **API HTTP existente**: mínima (relatórios docx/pdf, cep, health, cron). Quase tudo passa por Server Actions, que **não são consumíveis por um app mobile**.
- **Validação**: Zod 4, com schemas espalhados em `src/server/modules/*/[modulo].schema.ts` e `src/lib/zod`.

## 2. Conclusão de viabilidade (resumo executivo)

**É viável e a arquitetura atual ajuda.** O que um app mobile (React Native/Expo) reaproveita de verdade:

| Camada | Reaproveitável no mobile? |
| --- | --- |
| Services (`src/server/modules`) | Sim, indiretamente — via API HTTP que os exponha |
| Schemas Zod / tipos | Sim, diretamente — como pacote compartilhado (contrato da API) |
| Componentes React web | Não — RN usa primitivos próprios |
| Server Actions | Não — exclusivas do Next/browser |
| NextAuth v4 (cookie) | Não — mobile precisa de auth por token Bearer |

Os dois trabalhos reais do projeto mobile são: **(a)** criar uma camada de API HTTP versionada reutilizando os services existentes e **(b)** resolver autenticação por token. O monorepo é o suporte estrutural para compartilhar contratos entre web, API e mobile.

## 3. Estrutura-alvo

Ferramenta: **npm workspaces** (o projeto já usa npm) + **Turborepo** para orquestração/cache de tasks (adicionar na Fase 1; é leve e evita scripts manuais).

```
autismcad/
├── package.json            # raiz: workspaces + turbo
├── turbo.json
├── apps/
│   ├── web/                # app Next.js atual (movido quase intacto)
│   │   ├── src/app, src/components, src/server, ...
│   │   ├── next.config.ts, tsconfig.json, eslint, tailwind
│   │   └── package.json
│   └── mobile/             # Expo (Fase 4)
│       └── package.json
└── packages/
    ├── validators/         # schemas Zod + tipos de domínio = contrato web/API/mobile
    ├── db/                 # schema Drizzle, migrations, drizzle.config, scripts de seed/cleanup
    └── shared/             # utilidades puras (date-only, normalize, clock, errors)
```

Decisões e justificativas:

- **Services ficam em `apps/web`** (não viram pacote). Eles dependem de `server-only`, R2, Neon e da sessão — só rodam no servidor Next. Extraí-los para um pacote só valeria se houvesse um segundo backend, o que não é o caso (a API mobile será servida pelo próprio Next).
- **`packages/validators` é o pacote mais valioso**: os schemas Zod de `src/server/modules/*/[modulo].schema.ts` e `src/lib/zod` viram o contrato tipado consumido pelo web, pelas rotas de API e pelo mobile.
- **`packages/db` separado de `validators`**: o schema Drizzle puxa dependências server-side; o mobile nunca pode importá-lo.
- **API REST simples em `apps/web` (`/api/v1/*`)** em vez de tRPC/Hono: os schemas Zod já existem, os services já existem, e rotas REST no próprio Next evitam um novo deploy/serviço. tRPC adicionaria type-safety end-to-end, mas a um custo de adoção que não se justifica com contratos Zod compartilhados.

## 4. Fases

### Fase 1 — Monorepo base (esforço: ~1 dia)

1. Criar `apps/web` e mover o app Next inteiro (src, public, configs Next/Tailwind/ESLint).
2. `package.json` raiz com `workspaces: ["apps/*", "packages/*"]`; mover dependências para `apps/web/package.json`; adicionar Turborepo com tasks `dev`, `build`, `lint`, `typecheck`, `test`.
3. Ajustes mecânicos: `tsconfig` paths, `drizzle.config.ts`, caminhos dos scripts `tsx`, `.gitignore`.
4. Deploy: apontar Root Directory do Vercel (ou equivalente) para `apps/web`.

**Verificação:** `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` e `db:generate`/`db:check` passam; deploy de preview funciona.

### Fase 2 — Extração de pacotes (esforço: ~1–2 dias)

1. `packages/shared`: mover `src/lib/date-only.ts`, `src/server/shared/{normalize,clock,errors}.ts` (apenas o que é puro — `http.ts` e `pg-errors.ts` ficam no web).
2. `packages/validators`: mover schemas Zod dos módulos + `src/lib/zod` + tipos de domínio de `src/types`. **Regra: zero imports de drizzle, next ou node-only.**
3. `packages/db`: mover `schema.ts`, `jsonb-types.ts`, migrations, `drizzle.config.ts` e os scripts de `scripts/db`.
4. Atualizar imports no web (`@autismcad/validators`, `@autismcad/db`, `@autismcad/shared`).

**Verificação:** mesma bateria da Fase 1; nenhum pacote `validators`/`shared` importa código server-only (checável com lint rule ou grep no CI).

### Fase 3 — API mobile + auth por token (esforço: ~1–2 semanas, o maior risco)

1. **Auth**: criar `POST /api/v1/auth/login` que valida credenciais (reutiliza `src/server/auth/password.ts` e a lógica do `authorize` atual) e emite access token JWT + refresh token. Criar um `requirePermissionApi` que aceite `Authorization: Bearer` paralelo ao `requirePermission` de sessão. Alternativa mais estrutural: migrar NextAuth v4 → Better Auth (suporte nativo a Expo + sessões web), mas isso é um projeto à parte — recomendo começar com o endpoint próprio e avaliar a migração depois.
2. **Rotas `/api/v1/*`**: handlers finos que fazem `parse` com os schemas de `validators` e delegam aos services — exatamente o que as Server Actions já fazem hoje. Priorizar pelos fluxos do MVP mobile (ex.: agenda/consultas, pacientes, evolução) em vez de cobrir tudo.
3. **Logs de acesso e permissões**: reaproveitar `requirePermission`/`assertPacienteAccess`; garantir que o caminho por token registre nos access-logs como o caminho web.
4. Rate limiting básico no login.

**Verificação:** testes de integração das rotas v1 (login, 401/403, fluxo feliz por módulo); web continua intacto (Server Actions não mudam).

### Fase 4 — App mobile Expo (esforço: contínuo, MVP ~3–6 semanas)

1. `apps/mobile` com Expo + Expo Router; ajustar Metro para monorepo (`metro.config.js` com `watchFolders` apontando para a raiz — padrão documentado pelo Expo).
2. Cliente HTTP tipado consumindo `packages/validators` para parse/inferência das respostas.
3. Armazenamento seguro do token (`expo-secure-store`) + refresh automático.
4. MVP sugerido: login → agenda do dia → detalhe do paciente → registro de evolução. Upload de arquivos reusa o fluxo de URL assinada R2 já existente.

## 5. Riscos e pontos de atenção

- **Versões de React divergentes**: web usa React 19.2; Expo fixa a versão de RN/React por SDK. Com npm workspaces há risco de hoisting errado — mitigar mantendo `react`/`react-native` como dependências diretas de cada app e, se necessário, `overrides` por workspace. Este é o atrito clássico de monorepo com Expo; resolver na Fase 4, não antes.
- **NextAuth v4 é legado** (Auth.js v5 mudou bastante). A Fase 3 contorna sem migrar, mas vale planejar a troca (Better Auth é o caminho com melhor história para Expo) antes do mobile ir a produção.
- **Duplicação Server Action ↔ rota v1**: aceitável e controlada, pois ambas são camadas finas sobre os mesmos services. Não unificar prematuramente.
- **CI/CD**: pipeline precisa aprender os novos caminhos (turbo torna isso simples: `turbo run build --filter=web`).
- **Migrations**: conferir caminhos relativos em `drizzle.config.ts` e nos scripts após mover para `packages/db`.

## 6. Recomendação de sequência

Fases 1 e 2 são baratas, de baixo risco e já entregam o monorepo pronto — vale fazer mesmo antes de decidir o mobile em definitivo. A decisão de investimento real é a Fase 3 (API + auth); a Fase 4 só começa com a 3 estável. Se o mobile for descartado depois, as Fases 1–2 continuam úteis (organização e contratos tipados).
