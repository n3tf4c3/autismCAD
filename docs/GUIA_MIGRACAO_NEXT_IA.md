# Guia de Migracao para Next.js (IA/LLM)

## 1) Objetivo
Este documento registra o direcionamento da migracao do legado para Next.js e, principalmente, o estado atual do projeto para evitar decisoes baseadas em contexto antigo.

## 2) Estado atual do projeto (referencia: 2026-03-18)
- Aplicacao principal em Next.js (App Router), sem dependencia de runtime do backend legado.
- Autenticacao com NextAuth (Credentials) e sessao JWT.
- Persistencia com PostgreSQL + Drizzle ORM.
- Validacao com Zod.
- Arquivos em Cloudflare R2 (S3 SDK), com URLs assinadas.
- Grupo de rotas protegidas em `src/app/(protected)`.
- Regras de negocio centralizadas em `src/server/modules/*`.
- Parte relevante dos fluxos de escrita foi movida para Server Actions (`*.actions.ts`).
- Rotas HTTP `route.ts` foram mantidas apenas onde faz sentido de integracao externa/infra.

## 3) Arquitetura atual (resumo)
```text
autismcad/
  src/
    app/
      (protected)/
        pacientes/
        terapeutas/
        consultas/
        anamnese/
        prontuario/
        relatorios/
        configuracoes/
        logs-acesso/
      api/
        auth/[...nextauth]/route.ts
        cep/[cep]/route.ts
        health/route.ts
        health/r2/route.ts
        relatorios/evolutivo/pdf/route.ts
        relatorios/evolutivo/docx/route.ts
      login/
      impressao/
    components/
    lib/
    server/
      auth/
      db/
      modules/
        access-logs/
        anamnese/
        atendimentos/
        auth/
        dashboard/
        pacientes/
        prontuario/
        relatorios/
        terapeutas/
        users/
      shared/
      storage/
```

## 4) Convencoes em vigor
- `route.ts` deve permanecer fino: parse/validacao, permissao e delegacao para service.
- Regra de negocio em `src/server/modules/*`.
- Validacao de entrada com Zod nos schemas de dominio.
- Mudancas de escrita que exigem atomicidade devem usar `runDbTransaction` (ver `docs/transactions-migration-plan.md`).
- Para React/Next, seguir a skill local `vercel-react-best-practices`.

## 5) Status por dominio
- `auth/users/roles/permissions`: migrado.
- `pacientes`: migrado (inclui fluxo de arquivos por Server Actions).
- `terapeutas`: migrado.
- `atendimentos/consultas`: migrado.
- `anamnese`: migrado.
- `prontuario`: migrado.
- `relatorios`: migrado (inclui export PDF/DOCX via API).
- `dashboard` e `logs de acesso`: migrados.

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
Mantenha regras de negocio em src/server/modules e UI em src/app/(protected).
Nao mova logica de negocio para route.ts.
Preserve autorizacao/permissoes existentes.
Ao final, rode lint/typecheck/build e reporte impacto.
```

## 9) Referencias relacionadas
- `README.md`
- `docs/transactions-migration-plan.md`
