# AutismCAD

Monorepo da Clinica Girassois para gestao de pacientes TEA, profissionais, consultas, prontuarios, relatorios e app mobile de apoio aos profissionais/responsaveis.

## Stack
- Monorepo com npm workspaces + Turborepo
- Web: Next.js 16 (App Router) + React 19 + NextAuth v4 (Credentials/JWT)
- Mobile: Expo/React Native + Expo Router
- Banco: PostgreSQL + Drizzle ORM
- Contratos/validacao: Zod em `@autismcad/validators`
- Storage: Cloudflare R2 (S3 SDK) para arquivos

## Estrutura
- `apps/web`: aplicacao Next.js, rotas HTTP, Server Actions, services e UI web.
- `apps/mobile`: app Expo que consome `/api/v1` via token Bearer.
- `packages/db`: schema Drizzle, migrations e comandos `db:*`.
- `packages/validators`: schemas Zod compartilhados entre web/API/mobile.
- `packages/shared`: utilidades puras compartilhadas.
- `docs`: documentacao operacional, planos e historico tecnico.

## Modulos principais
- Dashboard com agenda do dia e mural de aniversariantes.
- Pacientes: cadastro, edicao, vinculos e arquivos.
- Profissionais: cadastro, agenda e status ativo.
- Consultas/atendimentos: agenda, recorrencia e presenca.
- Prontuario: documentos, evolucoes e plano de ensino.
- Anamnese e consentimento.
- Relatorios: assiduidade, devolutivas, evolutivo e exportacoes PDF/DOCX.
- Controle de acesso com RBAC, permissoes e logs de acesso.
- API mobile versionada em `/api/v1`.

## Requisitos
- Node.js 22+ recomendado.
- npm 11+ recomendado, conforme `packageManager`.
- PostgreSQL local/remoto.
- Android Studio ou EAS para builds mobile.

## Setup rapido
1. Instalar dependencias na raiz:
```bash
npm ci
```

2. Configurar ambiente web:
- Copie `apps/web/.env.example` para `apps/web/.env.local` e ajuste os valores.
- Para atomicidade real de transacoes, use `DATABASE_DRIVER=neon-serverless` e mantenha `REQUIRE_DB_TRANSACTIONS=1`.
- Quando usar Neon com `neon-serverless`, prefira configurar `DATABASE_URL_UNPOOLED` com endpoint sem `-pooler`.
- Em producao, R2 e `CRON_SECRET` sao obrigatorios em runtime.

3. Rodar migrations:
```bash
npm run db:migrate
```

4. Seed opcional do superadmin/RBAC:
```bash
npm run db:seed:admin -w @autismcad/web
```

5. Subir web local:
```bash
npm run dev -w @autismcad/web
```

6. Subir mobile Android local:
```bash
npm run android -w @autismcad/mobile
```

## Scripts da raiz
- `npm run dev`: executa `turbo run dev`.
- `npm run build`: build dos workspaces.
- `npm run lint`: lint dos workspaces.
- `npm run typecheck`: TypeScript sem emissao.
- `npm run test`: testes dos workspaces.
- `npm run db:generate`: gera SQL de migracao em `@autismcad/db`.
- `npm run db:migrate`: aplica migrations de `@autismcad/db`.
- `npm run db:check`: valida schema/migrations.
- `npm run db:push`: sincroniza schema diretamente no banco; use apenas em sandbox descartavel.
- `npm run db:studio`: Drizzle Studio.

## Scripts por workspace
- Web: `npm run dev|build|start|lint|typecheck|test -w @autismcad/web`.
- Mobile: `npm run start|android|ios|lint|typecheck -w @autismcad/mobile`.
- DB: `npm run db:generate|db:migrate|db:check|db:push|db:studio -w @autismcad/db`.
- Seed/limpezas web: `db:seed:admin`, `db:audit:legacy-passwords`, `db:cleanup:evolucao`, `db:cleanup:anamnese`, `db:cleanup:plano-ensino` em `@autismcad/web`.

## Endpoints uteis
- `GET /api/health`
- `GET /api/health/r2` (exige R2 configurado e permissao `ADMIN_GERAL`)
- `GET|POST /api/cron/r2-temp-cleanup` (exige `Authorization: Bearer $CRON_SECRET`)
- `GET /api/cep/:cep`
- `GET /api/relatorios/evolutivo/pdf`
- `GET /api/relatorios/evolutivo/docx`
- `GET /api/relatorios/plano-ensino/docx`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/atendimentos`
- `GET /api/v1/pacientes`
- `POST /api/v1/evolucoes`
- `GET /api/v1/relatorios/evolutivo`
- `POST /api/v1/consentimento`

## Arquivos no R2
- Upload de arquivos de paciente usa prefixo temporario: `pacientes/temp/{pacienteId}/{kind}/...`.
- O `commit` promove o objeto para `pacientes/{pacienteId}/{kind}/...` e remove o temporario.
- O endpoint `/api/cron/r2-temp-cleanup` remove objetos antigos em `pacientes/temp/` com base em `R2_TEMP_UPLOAD_RETENTION_HOURS`.
- Agende esse endpoint no provedor de sua preferencia e envie `Authorization: Bearer $CRON_SECRET`.
- Se o bucket tambem tiver lifecycle nativo para `pacientes/temp/`, o cron continua como fallback operacional.

## Documentacao interna
- `apps/mobile/README.md`
- `docs/banco-operacao.md`
- `docs/GUIA_MIGRACAO_NEXT_IA.md`
- `docs/transactions-migration-plan.md`
- `docs/troubleshooting-expo-monorepo.md`
