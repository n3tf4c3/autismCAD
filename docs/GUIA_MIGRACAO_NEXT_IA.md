# Guia de Migracao para Next.js (IA/LLM)

## 1) Objetivo
Migrar o projeto legado JavaScript (`AutismCAD-jscript`) para uma base unica em Next.js (`autismcad`) com:
- Frontend + backend no mesmo repositorio.
- TypeScript strict.
- Tailwind CSS v4.
- NextAuth para autenticacao.
- PostgreSQL + Drizzle ORM para dados.
- Zod para validacao de entrada/saida.
- Cloudflare R2 (SDK S3) para arquivos.
- Seguranca, comportamento e contratos de API preservados.

Este guia foi escrito para execucao assistida por IA/LLM com gates de seguranca, validacao continua e rollback simples.

## 2) Escopo e premissas
- Estado atual de referencia:
  - Backend legado Express com rotas em `AutismCAD-jscript/routes`.
  - Frontend estatico HTML em `AutismCAD-jscript/public`.
  - Novo app Next inicial em `autismcad/src/app`.
- Inventario atual:
  - 22 telas HTML legadas.
  - 46 endpoints de API (incluindo `/api/cep/:cep`).
  - Servicos de dominio em `services/*.js`.
  - Tabelas principais: `users`, `pacientes`, `terapeutas`, `atendimentos`, `anamnese`, `prontuario_documentos`, `evolucoes`, `audit_log`, `roles`, `permissions`, `role_permissions`.
- O objetivo da migracao e preservar comportamento primeiro e otimizar depois.

## 3) Skill obrigatoria durante a migracao
Aplicar regras da skill local:
- `.agents/skills/vercel-react-best-practices/SKILL.md`

Prioridades obrigatorias durante implementacao:
1. Eliminar waterfalls async (`async-*`).
2. Reduzir bundle (`bundle-*`).
3. Otimizar fronteira server/client (`server-*`).

Skill nao obrigatoria neste plano:
- `web-design-guidelines` (usar apenas quando fizer auditoria visual/acessibilidade).

## 4) Arquitetura alvo (proposta)
```text
autismcad/
  src/
    app/
      (public)/
      (dashboard)/
      api/
        auth/login/route.ts
        auth/logout/route.ts
        ...
    server/
      db/
        schema/
        drizzle.ts
        migrations/
      auth/
        auth.ts
        permissions.ts
      modules/
        pacientes/
          pacientes.schema.ts
          pacientes.repo.ts
          pacientes.service.ts
        terapeutas/
        atendimentos/
        anamnese/
        prontuario/
        relatorios/
        users/
        admin/
      shared/
        errors.ts
        http.ts
  lib/
    env.ts
    zod/
  drizzle.config.ts
```

Regras de arquitetura:
- `route.ts` deve ser fino (validar entrada, chamar service, retornar resposta).
- Regra de negocio fica em `src/server/modules/*`.
- Acesso a banco centralizado em `repo` usando Drizzle.
- Validacao de payload/query/response com Zod.
- Tipos compartilhados para request/response dos contratos criticos.
- Arquivos sempre em R2 com URL assinada quando necessario.

## 5) Estrategia de migracao recomendada (Strangler)
### Fase 0 - Baseline e congelamento de contrato
Objetivo: garantir comparacao antes/depois.

Checklist:
- Rodar baseline legado (testes e smoke de API).
- Salvar snapshot de respostas dos endpoints criticos (status + shape JSON).
- Mapear rotas legadas para backlog de migracao.
- Criar branch de migracao.

Comandos sugeridos:
```powershell
# legado
cd C:\Codes\Autism\AutismCAD-jscript
npm ci
npm test

# next
cd C:\Codes\Autism\autismcad
npm ci
npm run lint
npm run build
```

Gate para avancar:
- Baseline legado executado.
- Build do Next limpo.
- Lista de endpoints priorizada e congelada.

### Fase 1 - Fundacao Next com TypeScript
Objetivo: preparar infraestrutura para migrar sem reescrever tudo de uma vez.

Entregas:
- Estrutura `src/server/*`.
- Setup PostgreSQL + Drizzle (`drizzle.config.ts`, schema inicial e migrations).
- Setup NextAuth (session strategy, callbacks, providers/credentials).
- Setup Zod (schemas de request/response por dominio).
- Setup R2 com cliente S3 compativel e servico de upload/download assinado.
- Middlewares equivalentes (auth, permissao, erros).
- Configuracao de seguranca (headers, limite, upload policy).

Gate para avancar:
- Sem logica de negocio no `app/api` alem de orquestracao.
- Login/sessao via NextAuth validado.
- Conexao Postgres e migration inicial Drizzle funcionando.
- Fluxo de upload em R2 testado (put/get/delete).
- Lint e build sem erros.

### Fase 2 - Compatibilidade de API (baixo risco)
Objetivo: nao quebrar frontend durante migracao.

Estrategia:
- Implementar fallback temporario para APIs ainda nao migradas.
- Migrar por dominio e remover fallback gradualmente.

Backlog sugerido por ordem:
1. `auth` e `users` (base de sessao e permissoes).
2. `pacientes` e `terapeutas`.
3. `atendimentos`.
4. `anamnese`.
5. `prontuario`.
6. `relatorios` e `admin`.
7. `cep proxy`.

Gate por dominio:
- Endpoints do dominio com mesma assinatura JSON do legado.
- Erros e codigos HTTP equivalentes.
- Schemas Zod cobrindo entrada e saida.
- Testes de contrato do dominio verdes.

### Fase 3 - Migracao do frontend para App Router
Objetivo: substituir HTML estatico por paginas Next sem quebrar fluxos clinicos.

Rotas legadas para migrar:
- `/`, `/login`
- `/pacientes`, `/paciente-detalhe`, `/cadastro-paciente`
- `/terapeutas`, `/terapeuta-detalhe`, `/terapeuta-agenda`, `/cadastro-terapeuta`
- `/consultas`, `/calendario`
- `/anamnese`, `/prontuario`, `/novo-documento`, `/nova-evolucao`, `/novo-comportamento`, `/visualizar-documento`
- `/relatorios`, `/relatorio-clinico`, `/relatorio-evolutivo`, `/relatorio-periodo`
- `/configuracoes-permissoes`

Diretriz de implementacao:
- Priorizar Server Components.
- Client Components apenas para interacao/estado local.
- Data fetching no servidor sempre que possivel.
- Seguir regras `async-*`, `bundle-*`, `server-*` da skill local.

Gate por tela:
- Paridade funcional minima validada.
- Sem erro de hidratacao.
- Sem regressao de permissao/acesso.

### Fase 4 - Hardening e deploy
Objetivo: finalizar com seguranca operacional.

Entregas:
- Remover codigo legado nao usado.
- Ajustar pipeline CI (lint, test, build).
- Adicionar `drizzle-kit check`/migrate no pipeline.
- Configurar observabilidade (logs de erro + latencia).
- Executar smoke e testes de regressao final.

Gate final:
- Todos os endpoints em Next.
- Todas as telas criticas migradas.
- Sem dependencia de servidor legado para producao.

## 6) Plano de commits (recomendado)
Separar em commits pequenos e reversiveis:
1. `chore(base): setup nextauth + postgres + drizzle + zod + r2`
2. `feat(auth): migrar sessao/autorizacao para nextauth`
3. `feat(users): migrar usuarios, roles e permissoes`
4. `feat(pacientes-terapeutas): migrar modulos clinicos basicos`
5. `feat(atendimentos): migrar agenda e consultas`
6. `feat(anamnese-prontuario): migrar prontuario completo`
7. `feat(relatorios-admin): migrar relatorios e administracao`
8. `feat(ui): migrar telas app router em ondas`
9. `chore(cleanup): remover legado e fechar fallback`

Regra de ouro:
- 1 dominio por commit, com teste e build no mesmo commit.

## 7) Matriz de testes por fase
Testes minimos obrigatorios:
- Unitarios: funcoes de validacao e regras de permissao.
- Integracao: handlers de API por dominio.
- Contrato: comparar shape JSON Next vs legado.
- E2E smoke: login, pacientes, agendamento, prontuario, relatorio.
- Infra: upload/download/delete em R2 e expiracao de URL assinada.

Comandos sugeridos (ajustar conforme scripts criados):
```powershell
npm run lint
npm run test
npm run build
```

Checklist de regressao manual curta:
1. Login e logout.
2. CRUD de paciente.
3. CRUD de terapeuta.
4. Criacao e cancelamento de atendimento.
5. Consulta e edicao de prontuario/evolucao.
6. Geracao de relatorio PDF.

## 8) Riscos principais e mitigacao
1. Divergencia de contrato JSON entre legado e Next.
   - Mitigacao: snapshots por endpoint e testes de contrato por dominio.
2. Quebra de autenticacao/cookie.
   - Mitigacao: migrar `auth` primeiro com NextAuth e validar session/callbacks.
3. Exposicao indevida de uploads.
   - Mitigacao: armazenar no R2 privado + URL assinada + checagem de permissao.
4. Divergencia de schema entre app e banco.
   - Mitigacao: migrations Drizzle versionadas + review de schema.
5. Queda de performance apos migracao.
   - Mitigacao: aplicar regras da skill (`async-*`, `bundle-*`) e medir p95.
6. Deploy arriscado em big-bang.
   - Mitigacao: fases pequenas + commit reversivel + smoke a cada merge.

## 9) Definicao de pronto (DoD)
Um modulo so pode ser considerado migrado quando:
- Endpoint(s) no Next com mesma semantica do legado.
- Lint, testes e build verdes.
- Permissoes e autorizacao validadas.
- Schema Zod + schema Drizzle alinhados.
- Nao depende de codigo legado em runtime.
- Observabilidade minima (logs de erro) habilitada.

## 10) Protocolo de execucao para IA/LLM
Para cada tarefa de migracao, a IA deve responder neste formato:
1. Objetivo da tarefa (1 dominio/tela).
2. Arquivos que serao alterados.
3. Risco esperado.
4. Comandos de validacao.
5. Resultado do gate (passou/falhou).
6. Proximo commit sugerido.

Prompt padrao para cada passo:
```text
Execute a fase <X> deste guia, migrando apenas <dominio-ou-tela>.
Preserve contrato de API e permissoes.
Aplique as regras da skill vercel-react-best-practices (prioridade async, bundle, server).
Use NextAuth para autenticacao, Drizzle+Postgres para persistencia, Zod para validacao e R2 (S3 SDK) para arquivos.
Ao final, rode lint/test/build, informe o resultado e proponha o commit.
```

## 11) Decisoes abertas antes de iniciar implementacao
Validar com o responsavel do projeto:
1. Provider inicial do NextAuth (Credentials apenas, ou Credentials + OAuth).
2. Estrategia de sessao (JWT stateless vs database sessions).
3. Estrategia de migracao de dados MySQL -> PostgreSQL (dump + transform + carga).
4. Estrategia de migracao de arquivos locais -> R2 (batch unico vs incremental).

Direcao definida neste projeto:
- Usar NextAuth desde o inicio.
- Usar PostgreSQL com Drizzle ORM desde o inicio.
- Usar Zod para todos os contratos de API.
- Usar Cloudflare R2 como storage padrao.
