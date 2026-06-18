# Plano: Bootstrap do monorepo em C:\Codes\autismcad-mono

Data: 2026-06-12

## Status em 2026-06-16

Este documento e historico. O bootstrap do monorepo ja foi incorporado ao diretorio atual do projeto, que usa:

- `apps/web` para o Next.js.
- `apps/mobile` para o Expo.
- `packages/db`, `packages/validators` e `packages/shared` para codigo compartilhado.
- `package.json` raiz com workspaces e Turborepo.

Use este arquivo apenas como registro do processo de migracao. Para operacao atual, prefira `README.md`, `docs/banco-operacao.md` e `apps/mobile/README.md`.

Complementa o [plano de monorepo + mobile](./plano-monorepo-mobile.md). Aquele documento define **o quê** (estrutura-alvo, pacotes, fases); este define **como subir a estrutura num diretório novo** (`C:\Codes\autismcad-mono`), mantendo `C:\Codes\autismcad` intacto e funcional durante toda a migração.

## 1. Decisões de partida

| Decisão | Escolha | Justificativa |
| --- | --- | --- |
| Origem do código | `git clone` do repo atual dentro de `autismcad-mono` | Preserva todo o histórico; `git mv` mantém rastreabilidade dos arquivos movidos |
| Repositório | O mesmo (`n3tf4c3/autismCAD`), em branch `monorepo` | Evita repo paralelo; merge na `main` quando validado. O diretório antigo vira backup natural até o cutover |
| Workspaces | npm workspaces (projeto já usa npm) | Sem troca de package manager |
| Orquestração | Turborepo (`turbo`) | Tasks `dev/build/lint/typecheck/test` com cache, conforme plano anterior |
| Escopo deste bootstrap | Fases 1 e 2 do plano anterior (estrutura + extração de pacotes) | API mobile (Fase 3) e Expo (Fase 4) ficam para depois, já com a casa arrumada |

## 2. Estrutura-alvo

```
autismcad-mono/                      # clone do repo, branch monorepo
├── package.json                     # privado: workspaces + turbo + overrides
├── turbo.json
├── tsconfig.base.json               # compilerOptions comuns
├── .env.local                       # copiado manualmente (não versionado)
├── docs/  relatorios/               # ficam na raiz
├── apps/
│   └── web/                         # app Next.js atual, movido quase intacto
│       ├── src/  public/
│       ├── next.config.ts  postcss.config.mjs  eslint.config.mjs
│       ├── tsconfig.json            # extends ../../tsconfig.base.json, paths @/*
│       └── package.json             # @autismcad/web
└── packages/
    ├── shared/                      # @autismcad/shared — utilidades puras
    ├── validators/                  # @autismcad/validators — schemas Zod + tipos
    └── db/                          # @autismcad/db — Drizzle, migrations, scripts
```

## 3. Etapas

### Etapa 0 — Preparação (minutos)

1. `git clone https://github.com/n3tf4c3/autismCAD.git C:\Codes\autismcad-mono` (o diretório existe vazio; clonar nele).
2. `git switch -c monorepo`.
3. Copiar `.env.local` de `C:\Codes\autismcad` para a raiz do clone (não versionado).
4. **Não copiar** `node_modules`, `.next`, `tsconfig.tsbuildinfo` — install limpo depois.

**Verificação:** antes de qualquer mudança, `npm install && npm run build && npm test` passam no clone (baseline).

### Etapa 1 — Esqueleto do monorepo (Fase 1 do plano anterior)

1. Criar `apps/web/` e mover com `git mv`: `src/`, `public/`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `next-env.d.ts`, `drizzle.config.ts` (temporariamente — vai para `packages/db` na Etapa 3), `scripts/`.
2. Novo `package.json` raiz:
   - `"workspaces": ["apps/*", "packages/*"]`
   - `devDependencies`: apenas `turbo`
   - **`overrides` (postcss, esbuild, uuid) ficam na raiz** — npm só aplica overrides do package.json raiz
   - scripts delegando ao turbo: `dev`, `build`, `lint`, `typecheck`, `test`
3. `apps/web/package.json` (`@autismcad/web`): recebe todas as dependências e devDependencies atuais, e os scripts `dev/build/start/lint/typecheck/test/db:*` como estão hoje.
4. `turbo.json` com pipeline: `build` (dependsOn `^build`, outputs `.next/**` exceto cache), `lint`, `typecheck`, `test`, `dev` (cache false, persistent).
5. `tsconfig.base.json` na raiz com os compilerOptions atuais; `apps/web/tsconfig.json` faz `extends` e mantém `"paths": { "@/*": ["./src/*"] }` e o plugin do Next. **Nenhum import muda nesta etapa** — `src` se move inteiro, então `@/*` continua válido.
6. Ajustes mecânicos: `.gitignore` (adicionar `.turbo/`), caminho do dotenv no `drizzle.config.ts` se os scripts rodarem de `apps/web` (o `.env.local` está na raiz → `config({ path: "../../.env.local" })`).

**Verificação:** na raiz, `npm install`, `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` passam; `npm run db:check -w @autismcad/web` passa; `npm run dev` sobe e o login funciona.

### Etapa 2 — Commit de movimentação pura

Commit dedicado só com os `git mv` + configs novas, **sem mudança de conteúdo de código**. Isso mantém o diff legível e o `git blame` útil. Mudanças de conteúdo (imports, etc.) vêm em commits separados na Etapa 3.

### Etapa 3 — Extração de pacotes (Fase 2 do plano anterior)

Ordem: `shared` → `validators` → `db` (do menos para o mais acoplado), um commit por pacote, validando a bateria completa entre cada um.

1. **`packages/shared`** (`@autismcad/shared`): `src/lib/date-only.ts`, `src/server/shared/{normalize,clock,errors}.ts`. `http.ts` e `pg-errors.ts` **ficam no web** (dependem de Next/driver).
2. **`packages/validators`** (`@autismcad/validators`): schemas Zod de `src/server/modules/*/[modulo].schema.ts` + `src/lib/zod` + tipos de `src/types`. Regra de pureza: zero imports de `drizzle-orm`, `next`, `server-only` ou APIs node-only — conferir com grep no CI.
3. **`packages/db`** (`@autismcad/db`): `src/server/db/{schema.ts,jsonb-types.ts,migrations}`, `drizzle.config.ts`, `scripts/db/*`. Os scripts `db:*` saem do web e viram scripts deste pacote (`npm run db:generate -w @autismcad/db`).
4. Atualizar imports no web para `@autismcad/{shared,validators,db}` (busca e troca mecânica, módulo a módulo).
5. Pacotes consumidos **como TypeScript fonte** (sem build próprio): `"exports"` apontando para `./src/*.ts` + `transpilePackages` no `next.config.ts`. Evita pipeline de build de pacote nesta fase.

**Verificação por pacote:** bateria completa da Etapa 1 + grep de pureza no `validators`/`shared` + `db:generate` não gera migration nova (schema inalterado).

### Etapa 4 — CI/CD e cutover

1. Vercel (ou equivalente): Root Directory → `apps/web`; build command `turbo run build --filter=@autismcad/web...` ou padrão da plataforma para monorepo. Validar com deploy de preview da branch `monorepo`.
2. Abrir PR `monorepo` → `main`. Janela de merge curta: trabalho em paralelo na `main` durante a migração gera conflitos chatos (arquivos movidos), então congelar features no repo antigo durante a reta final.
3. Após merge: `C:\Codes\autismcad-mono` vira o diretório de trabalho; `C:\Codes\autismcad` fica como cópia antiga até ganhar confiança, depois é apagado.

## 4. Riscos e pontos de atenção

- **Conflitos com trabalho paralelo na `main`**: o maior risco operacional. Renomes em massa + commits novos na `main` = conflitos manuais. Mitigação: migrar rápido (Etapas 1–2 cabem em um dia) e congelar a `main` na reta final.
- **`overrides` do npm**: só funcionam no `package.json` raiz do workspace — se ficarem em `apps/web`, são ignorados silenciosamente.
- **Hoisting**: com npm workspaces as deps sobem para `node_modules` da raiz. Next/Tailwind/Drizzle lidam bem; se algo resolver módulo errado, usar `overrides` ou instalar a dep diretamente no workspace afetado.
- **Caminhos relativos**: `drizzle.config.ts` (schema/out/dotenv) e os scripts `tsx scripts/db/*` assumem cwd na raiz do app — revisar todos após mover.
- **`.env.local`**: precisa estar onde o Next procura (`apps/web/`) **e** ser achável pelos scripts do `db`. Opção simples: manter em `apps/web/.env.local` na Etapa 1 e, na Etapa 3, o `drizzle.config.ts` do `packages/db` aponta para ele (ou duplicar — documentar a escolha no README).
- **Windows + git mv**: funciona normalmente; atenção apenas a case-rename (não há nenhum previsto).

## 5. Critério de pronto

O bootstrap está concluído quando, em `autismcad-mono`:

1. `npm install` + `turbo run build lint typecheck test` passam na raiz;
2. `npm run dev` sobe o app e os fluxos principais funcionam (login, agenda, prontuário);
3. `db:generate`/`db:check` rodam do `packages/db` sem gerar migration espúria;
4. grep de pureza confirma `validators`/`shared` sem imports server-only;
5. deploy de preview da branch `monorepo` está verde.
