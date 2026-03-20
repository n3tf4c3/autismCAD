# AutismCAD (Next.js)

Aplicacao web da Clinica Girassois para gestao de pacientes TEA, profissionais, consultas, prontuarios e relatorios.

## Stack
- Next.js (App Router) + React
- NextAuth (Credentials)
- PostgreSQL + Drizzle ORM
- Zod para validacao
- Cloudflare R2 (S3 SDK) para arquivos

## Modulos principais
- Dashboard com agenda do dia e mural de aniversariantes
- Pacientes (cadastro, edicao, vinculos, arquivos)
- Profissionais (cadastro, agenda, status ativo)
- Consultas/atendimentos (agenda, recorrencia, presenca)
- Prontuario (evolucoes, documentos, plano de ensino)
- Relatorios (assiduidade, devolutivas, evolutivo com export PDF/DOCX)
- Controle de acesso com RBAC (roles/permissoes e logs de acesso)

## Estrutura de codigo
- `src/app`: paginas e rotas HTTP (App Router)
- `src/server/modules`: regras de negocio por dominio
- `src/server/db`: schema e migracoes
- `src/components`: componentes de UI
- `docs`: documentacao interna de migracao e transacoes

## Requisitos
- Node.js (recomendado: 22+)
- PostgreSQL (local ou remoto)

## Setup rapido
1. Instalar dependencias:
```bash
npm ci
```

2. Configurar ambiente:
- Copie `./.env.example` para `./.env.local` e ajuste os valores.
- Para atomicidade real de transacoes, use `DATABASE_DRIVER=neon-serverless` e mantenha `REQUIRE_DB_TRANSACTIONS=1`.
- Quando usar Neon com `neon-serverless`, prefira configurar `DATABASE_URL_UNPOOLED` (endpoint sem `-pooler`).
- Use `runDbTransaction` apenas em fluxos com multiplos statements que precisem commit/rollback conjunto.

3. Rodar migrations:
```bash
npm run db:migrate
```

4. (Opcional) Seed do superadmin + RBAC:
```bash
npm run db:seed:admin
```

5. Subir ambiente local:
```bash
npm run dev
```

## Scripts
- `npm run dev`: servidor de desenvolvimento
- `npm run build`: build de producao
- `npm run start`: sobe a build de producao
- `npm run lint`: ESLint
- `npm run typecheck`: TypeScript sem emissao
- `npm run db:generate`: gera SQL de migracao (Drizzle)
- `npm run db:migrate`: aplica migracoes
- `npm run db:check`: valida schema/migracoes
- `npm run db:push`: sincroniza schema no banco (uso controlado)
- `npm run db:studio`: Drizzle Studio
- `npm run db:seed:admin`: seed inicial de usuario admin/RBAC
- `npm run db:cleanup:evolucao`: limpeza de payload legado de evolucao
- `npm run db:cleanup:anamnese`: limpeza de payload legado de anamnese

## Endpoints uteis
- `GET /api/health`
- `GET /api/health/r2` (exige R2 configurado e permissao `ADMIN_GERAL`)
- `GET /api/cep/:cep`
- `GET /api/relatorios/evolutivo/pdf`
- `GET /api/relatorios/evolutivo/docx`

## Documentacao interna
- `docs/GUIA_MIGRACAO_NEXT_IA.md`
- `docs/transactions-migration-plan.md`
