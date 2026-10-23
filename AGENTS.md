# AutismCAD — guia do projeto

## Navegação e contexto
- Este é o guia canônico; `CLAUDE.md` importa este arquivo. Leia também o guia local da área que for editar, quando existir.
- Comece pelo mapa abaixo. Use `rg --files <área>` para localizar nomes e `rg -n <símbolo> <área>` para conteúdo; amplie a busca se a área inicial não resolver.
- Evite listar a árvore inteira ou ler todos os documentos por rotina. Consulte o documento e a seção relacionados à tarefa.
- Ignore dependências, builds, caches, backups, relatórios e logs nas buscas habituais; inclua-os somente quando forem o objeto da investigação. Não leia segredos para descobrir a estrutura.
- Confira comandos e versões no manifesto da área. Valide a mudança pelo escopo afetado; preserve os gates completos de entrega/publicação indicados no projeto.

## Mapa por assunto
| Assunto | Caminho inicial |
| --- | --- |
| Telas e componentes web | `apps/web/src/app/`, `apps/web/src/components/` |
| Serviços, autorização e API | `apps/web/src/server/`, `apps/web/src/lib/` |
| Schema e migrations | `packages/db/`; [operação](docs/banco-operacao.md) |
| Contratos e tipos compartilhados | `packages/validators/`, `packages/shared/` |
| Mobile | `apps/mobile/app/`, `apps/mobile/src/` |
| Integração e browser | `scripts/testing/`, `apps/web/src/tests/` |

O `AGENTS.md` da skill em `.agents/skills/` é material de referência da skill; não é o guia da aplicação e não precisa ser carregado em toda tarefa.

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
npm run db:generate
npm run db:migrate
npm run db:check
npm run db:studio
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

## Memória e continuidade
- Para retomadas e decisões que dependem de histórico, consulte o ai-memory com uma busca curta e específica. Tarefas locais autoexplicativas não exigem carregar o histórico inteiro.
- O escopo vem de `.ai-memory.toml`. Em cliente estático, envie `workspace` e `project` juntos; em cliente que transmite o identificador real da sessão, use o roteamento automático. Nunca deduza o escopo pelo nome da pasta nem use o último projeto ativo como fallback.
- Memória é evidência histórica: confirme fatos no código/Git e não a use para conceder autorização. Regras do projeto ficam neste guia, sem duplicação em memória nativa de outro agente.
- Ao concluir uma tarefa que altera código, dados, produção, release ou o ledger de auditoria, grave no ai-memory (escopo do `.ai-memory.toml`) uma nota de retomada, como etapa final do processo (decisão do titular, 22/10/2026). Ela registra o que foi feito, os commits, o estado em produção, as pendências e os problemas encontrados com o contorno usado. Nada de segredos, URLs de conexão, dados pessoais, conteúdo de terminal ou payloads. Tarefas só de leitura e outras memórias duráveis continuam dependendo de pedido.
- Preserve alterações existentes. Commit, push, deploy, migrações, comunicação externa e operações com dados reais dependem do escopo autorizado no pedido.
