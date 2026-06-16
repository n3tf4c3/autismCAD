# Guia de Migracao para Next.js (IA/LLM)

## 1) Objetivo
Este documento registra o direcionamento da migracao do legado para Next.js e, principalmente, o estado atual do projeto para evitar decisoes baseadas em contexto antigo.

## 2) Estado atual do projeto (referencia: 2026-06-16)
- Monorepo com `apps/web`, `apps/mobile` e pacotes compartilhados em `packages/*`.
- Aplicacao web principal em Next.js (App Router), sem dependencia de runtime do backend legado.
- Aplicacao mobile Expo em `apps/mobile`, consumindo `/api/v1` com token Bearer.
- Autenticacao com NextAuth (Credentials) e sessao JWT.
- API mobile com endpoints proprios de login/refresh em `/api/v1/auth/*`.
- Persistencia com PostgreSQL + Drizzle ORM.
- Validacao com Zod em `packages/validators` e schemas ainda especificos do servidor quando nao compartilhados.
- Arquivos em Cloudflare R2 (S3 SDK), com URLs assinadas.
- Grupo de rotas protegidas em `apps/web/src/app/(protected)`.
- Regras de negocio centralizadas em `apps/web/src/server/modules/*`.
- Parte relevante dos fluxos de escrita foi movida para Server Actions (`*.actions.ts`).
- Rotas HTTP `route.ts` sao usadas para integracao externa/infra e API mobile versionada.

## 3) Arquitetura atual (resumo)
```text
autismcad/
  apps/
    web/
      src/
        app/
          (protected)/
            pacientes/
            profissionais/
            consultas/
            calendario/
            anamnese/
            prontuario/
            relatorios/
            configuracoes/
            logs-acesso/
          api/
            auth/[...nextauth]/route.ts
            v1/
            cep/[cep]/route.ts
            health/route.ts
            health/r2/route.ts
            cron/r2-temp-cleanup/route.ts
            relatorios/
          login/
          consentimento/
          privacidade/
          exclusao-de-conta/
          impressao/
        components/
        lib/
        server/
          auth/
          db/
          modules/
            access-logs/
            agenda/
            anamnese/
            atendimentos/
            consent/
            dashboard/
            pacientes/
            profissionais/
            prontuario/
            relatorios/
            users/
          shared/
          storage/
    mobile/
      app/
      src/
  packages/
    db/
    shared/
    validators/
```

## 4) Convencoes em vigor
- `route.ts` deve permanecer fino: parse/validacao, permissao e delegacao para service.
- Regra de negocio em `apps/web/src/server/modules/*`.
- Validacao compartilhada em `packages/validators`; validacao server-only deve ficar no web.
- Mudancas de escrita que exigem atomicidade devem usar `runDbTransaction` (ver `docs/transactions-migration-plan.md`).
- Pacotes `@autismcad/shared`, `@autismcad/validators` e `@autismcad/db` sao consumidos como fonte TypeScript via `transpilePackages`.
- Para React/Next, seguir a skill local `vercel-react-best-practices`.

## 5) Status por dominio
- `auth/users/roles/permissions`: migrado.
- `pacientes`: migrado (inclui fluxo de arquivos por Server Actions).
- `profissionais`: migrado.
- `atendimentos/consultas`: migrado.
- `anamnese`: migrado.
- `prontuario`: migrado.
- `relatorios`: migrado (inclui export PDF/DOCX via API).
- `dashboard` e `logs de acesso`: migrados.
- `mobile/API v1`: MVP implementado para login/refresh, agenda/atendimentos, pacientes, evolucoes, devolutiva/evolutivo e consentimento.

## 6) O que este guia substitui
Este arquivo substitui premissas antigas, por exemplo:
- contagem fixa de endpoints do legado;
- estrutura proposta com `(dashboard)` e modulo `admin/` (nao existente na estrutura atual);
- comandos de teste que nao existem nos scripts atuais.

## 7) Comandos de validacao atuais
```bash
npm run lint
npm run typecheck
npm run build
npm run test
```

Comandos de banco:
```bash
npm run db:generate
npm run db:migrate
npm run db:check
npm run db:studio
```

## 8) Protocolo para IA/LLM em manutencao
Para cada tarefa:
1. Informar objetivo e escopo (dominio/tela).
2. Listar arquivos alterados.
3. Explicar risco de regressao.
4. Rodar `lint`, `typecheck` e `build` quando aplicavel.
5. Reportar resultado e proximo passo.

Prompt base recomendado:
```text
Execute apenas <escopo>.
Mantenha regras de negocio em apps/web/src/server/modules e UI em apps/web/src/app/(protected).
Nao mova logica de negocio para route.ts.
Preserve autorizacao/permissoes existentes.
Ao final, rode lint/typecheck/build e reporte impacto.
```

## 9) Referencias relacionadas
- `README.md`
- `docs/transactions-migration-plan.md`
