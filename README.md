# AutismCAD (Next.js)

Base Next.js (App Router) para o AutismCAD, migrando o legado `AutismCAD-jscript` para uma base unica com:
- NextAuth (Credentials) para autenticacao.
- PostgreSQL + Drizzle ORM.
- Zod para validacao.
- Cloudflare R2 (S3 SDK) para arquivos.

O guia do processo esta em `docs/GUIA_MIGRACAO_NEXT_IA.md`.

## Requisitos
- Node.js (recomendado: 22+)
- PostgreSQL (local ou remoto)

## Setup Rapido
1. Instalar deps:
```bash
npm ci
```

2. Configurar ambiente:
- Copie `./.env.example` para `./.env.local` e ajuste os valores.

3. Rodar migrations:
```bash
npm run db:migrate
```

4. (Opcional) Seed do superadmin + RBAC:
```bash
npm run db:seed:admin
```

5. Subir dev server:
```bash
npm run dev
```

## Scripts
- `npm run dev`: dev server
- `npm run lint`: ESLint
- `npm run typecheck`: `tsc --noEmit`
- `npm run build`: build de producao
- `npm run db:check`: valida migracoes/schema (Drizzle)
- `npm run db:migrate`: aplica migracoes
- `npm run db:studio`: Drizzle Studio

## Healthchecks
- `GET /api/health`
- `GET /api/health/r2` (exige R2 configurado)

