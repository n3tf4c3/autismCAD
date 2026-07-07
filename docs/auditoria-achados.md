# Ledger de Achados de Auditoria

Registro versionado da numeracao e do status dos achados de auditoria. Os relatorios
completos vivem em `relatorios/` (gitignored, nao versionado); este ledger e a unica
memoria duravel de **qual numero ja foi usado** e **qual o status de cada achado**.

- **Fonte de verdade da numeracao**: o maior numero entre este ledger e os commits
  (`git log --grep=achado -i`). Proximo achado = esse maximo + 1. Nunca reiniciar em 1.
- **Proximo numero livre: 129.**
- Mantido pelas skills `auditoria-tecnica` (cria achados novos como ABERTO) e
  `resolver-auditoria` (atualiza o status apos a correcao). Toda mensagem de commit
  cita o numero do achado.

## Achados ativos (rastreados individualmente)

Auditoria 2026-06-17 (`relatorios/auditoria-2026-06-17-104859.md`).

| # | Achado | Severidade | Status |
|---|--------|-----------|--------|
| 102 | Ultimo `admin-geral` pode ser excluido | Alta | RESOLVIDO |
| 103 | Refresh tokens mobile stateless e nao revogaveis | Alta | RESOLVIDO |
| 104 | Integridade evolucoes/atendimentos sem mesmo paciente/profissional | Alta (potencial) | RESOLVIDO |
| 105 | `db:push`/bootstrap nao cobre funcoes/triggers manuais | Alta (potencial) | RESOLVIDO |
| 106 | API mobile com CORS coringa por padrao em producao | Media | RESOLVIDO |
| 107 | `drizzle.config.ts` com fallback silencioso para banco local | Media | RESOLVIDO |
| 108 | Listagens/relatorios sem paginacao ou limite server-side | Media (potencial) | RESOLVIDO |
| 109 | Datas `YYYY-MM-DD` invalidas passam em contratos/normalizadores | Media | RESOLVIDO |
| 110 | Filtros de periodo de atendimentos como string simples | Media | RESOLVIDO |
| 111 | Mobile usa `as T` sem validacao runtime das respostas | Media | RESOLVIDO |
| 112 | Refresh concorrente no mobile nao serializado | Media (potencial) | RESOLVIDO |
| 113 | Mobile sem timeout/abort nas chamadas API | Media | RESOLVIDO |
| 114 | Conversao de contagens de evolucao mascara entradas invalidas | Media | RESOLVIDO |
| 115 | FKs `ON DELETE cascade` em dados clinicos vs soft-delete | Media (potencial) | RESOLVIDO |
| 116 | Vinculos ativos apos soft-delete de usuario/paciente | Media (potencial) | RESOLVIDO |
| 117 | `prontuario_documentos` com unique global bloqueia recriacao | Baixa/Media (potencial) | ABERTO (aceito) |
| 118 | Criacao de paciente antes de uploads deixa cadastro parcial | Baixa/Media (potencial) | RESOLVIDO |
| 119 | `npm audit` com vulnerabilidades transitivas moderadas/baixa | Baixa/Media | ABERTO (aceito) |
| 120 | Campos de versao aceitam zero/negativo em inserts diretos | Baixa (potencial) | RESOLVIDO |
| 121 | `access_logs.status` sem dominio fechado | Baixa | RESOLVIDO |

Auditoria 2026-06-17 (`relatorios/auditoria-2026-06-17-211918.md`).

| # | Achado | Severidade | Status |
|---|--------|-----------|--------|
| 122 | Consentimento LGPD imposto so no cliente mobile; API por token nao bloqueia e reconsentimento nao atinge sessoes ativas | Media | RESOLVIDO |
| 123 | Mobile desloga em falha de rede/timeout/5xx durante o refresh, nao so em 401/403 | Baixa | RESOLVIDO |

Auditoria 2026-06-18 (`relatorios/auditoria-2026-06-18-025126.md`).

| # | Achado | Severidade | Status |
|---|--------|-----------|--------|
| 124 | Data de nascimento de profissional aceita entrada invalida e e descartada silenciosamente (null), divergindo de pacientes | Baixa | RESOLVIDO |
| 125 | Endereco composto pode exceder `endereco varchar(255)` e gerar erro 22001 nao tratado no save de profissionais | Baixa (potencial) | RESOLVIDO |

Auditoria 2026-07-07 (`relatorios/auditoria-2026-07-07-192036.md`).

| # | Achado | Severidade | Status |
|---|--------|-----------|--------|
| 126 | Falha no pre-preenchimento da edicao de evolucao (mobile) deixa o form vazio e salvavel — PUT pode sobrescrever o payload clinico existente | Media (potencial) | ABERTO |
| 127 | Agenda mobile nao recarrega ao voltar do form de evolucao; card recem-evoluido reabre em modo criacao e cai no 409 | Baixa | ABERTO |
| 128 | Web sem headers de seguranca HTTP (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, CSP) | Baixa | ABERTO |

## Historico resolvido (achados 1-101)

Reconstruido de `git log --grep=achado -i`. Agrupado pelo commit que resolveu cada
grupo; os relatorios originais nao sao versionados. Status RESOLVIDO salvo indicacao.

| Achados | Commit | Descricao | Status |
|---------|--------|-----------|--------|
| 1 | `15f9832` | baseline squash das migrations | RESOLVIDO |
| 2, 3, 9 | `a2a981c` | correcoes de escopo (auditoria 2026-06-07) | RESOLVIDO |
| 4 | `9e27477` | campos de arquivo validados contra chave R2 do paciente | RESOLVIDO |
| 6, 16, 17, 18, 19, 20 | `3501ab0` | rbac e validacao | RESOLVIDO |
| 7, 10, 11 | `2d8dd13` | correcoes em usuarios | RESOLVIDO |
| 12, 13 | `f02786b` | bloqueios de agenda no banco e gate de criacao | RESOLVIDO |
| 14, 15, 24, 25 | `12ae4e4` | correcoes de UI | RESOLVIDO |
| 26-38 | `fbdf6ea` | auditoria 2026-06-10 (lote) | RESOLVIDO |
| 39 | `9e5b135`, `b80858f`, `5a43480` | upgrade de dependencias / zerar vulns | RESOLVIDO |
| 40, 41 | `4465ae6` | relatorios: role fresco e escopo por profissional | RESOLVIDO |
| 42, 43 | `bb4c356` | rbac-ui: navegacao e acoes por permissao efetiva | RESOLVIDO |
| 44, 45, 46 | `1ed270e` | metadados R2 e integridade de agenda | RESOLVIDO |
| 47, 48, 49, 50 | `789d5a9` | env, relatorios, arquitetura | RESOLVIDO |
| 51 | `c1c18a1` | restricao de evolucao por papel efetivo | RESOLVIDO |
| 52, 55 | `e885895` | agenda: lock de grupo e ordem de datas | RESOLVIDO |
| 53 | `c6b2d61`, `e7c82b2` | rbac-ui: papel efetivo nas paginas server | RESOLVIDO |
| 54 | `f710af9` / `7cfc054` | numero reutilizado: deps esbuild/tsx e UI loaders | RESOLVIDO |
| 55, 59, 63, 64, 65 | `005bb74` | achados Media | RESOLVIDO |
| 56, 57, 58 | `671e013` | seguranca: autorizacao (Alta) | RESOLVIDO |
| 60 | `d017214` | rate limit/lockout de login | RESOLVIDO |
| 61, 66 | `98cb5c1` | email unico parcial e check constraints | RESOLVIDO |
| 67, 69 | `b6ee86f` | scripts e health | RESOLVIDO |
| 70, 83, 85, 96 | `b0fb9aa` | prontuario | RESOLVIDO |
| 71, 90, 91 | `77cc45d` | evolucao herda data do atendimento + cleanups | RESOLVIDO |
| 74, 78 | `56c3a80` | mobile auth: role efetiva no refresh + API base url | RESOLVIDO |
| 75, 89, 98 | `2087b39` | seed superadmin e salvaguardas de cleanup | RESOLVIDO |
| 76, 86, 87, 88, 100, 101 | `7ca2d38` | constraints de banco e validacao real de data/horario | RESOLVIDO |
| 77 | `20b9ee3` | mobile: dia padrao usa "hoje" da clinica | RESOLVIDO |
| 79 | `fb26c6d` | contrato compartilhado da API v1 web<->mobile | RESOLVIDO |
| 80, 81, 99 | `ac071c8` | decisoes de seguranca aceitas (documentadas) | ABERTO (aceito) |
| 84, 97 | `301889d` | mobile: guarda central de rotas autenticadas | RESOLVIDO |
| 93, 94 | `cf7cdf8` | web: UI de pacientes/profissionais por permissao efetiva | RESOLVIDO |

### Numeros sem rastro no git (5, 8, 21, 22, 23, 62, 68, 72, 73, 82, 92, 95)

Provavelmente achados de relatorios locais (gitignored) que foram nao acionaveis,
renomeados ou marcados "sem inconsistencia". Status DESCONHECIDO — nao re-verificar
salvo se reaparecerem numa auditoria futura.
