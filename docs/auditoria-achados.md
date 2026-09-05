# Ledger de Achados de Auditoria

Registro versionado da numeracao e do status dos achados de auditoria. Os relatorios
completos vivem em `C:\Codes\relatorios\autismcad\` ou no legado `relatorios/`
(fora do Git); este ledger e a unica
memoria duravel de **qual numero ja foi usado** e **qual o status de cada achado**.

- **Fonte de verdade da numeracao**: o maior numero entre este ledger e os commits
  (`git log --grep=achado -i`). Proximo achado = esse maximo + 1. Nunca reiniciar em 1.
- Mantido pelas skills `auditoria-tecnica` (cria achados novos como ABERTO) e
  `resolver-auditoria` (atualiza o status apos a correcao). Toda mensagem de commit
  cita o numero do achado.

## Achados ativos (rastreados individualmente)

Auditoria 2026-06-17 (`relatorios/auditoria-2026-06-17-104859.md`).

| # | Achado | Severidade | Status |
|---|--------|-----------|--------|
| 102 | Ultimo `admin-geral` pode ser excluido | Alta | RESOLVIDO — reincidencia concorrente fechada em 2026-09-05: lock transacional comum em update/delete e revalidacao do ator; tres corridas PostgreSQL com conexoes independentes preservam um admin, e controle negativo reproduz zero sem a protecao |
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
| 113 | Mobile sem timeout/abort nas chamadas API | Media | RESOLVIDO — residual de 2026-09-05 fechado: timer e signal permanecem ativos ate ler o corpo; regressao usa HTTP real com headers imediatos e corpo incompleto |
| 114 | Conversao de contagens de evolucao mascara entradas invalidas | Media | RESOLVIDO — residual de 2026-09-05 fechado nos schemas de criacao/edicao: inteiros finitos, nao negativos e seguros; vazio opcional vira null; acertos <= tentativas. POST/PUT rejeitam antes da escrita; leitores historicos preservados |
| 115 | FKs `ON DELETE cascade` em dados clinicos vs soft-delete | Media (potencial) | RESOLVIDO |
| 116 | Vinculos ativos apos soft-delete de usuario/paciente | Media (potencial) | RESOLVIDO |
| 117 | `prontuario_documentos` com unique global bloqueia recriacao | Baixa/Media (potencial) | RESOLVIDO |
| 118 | Criacao de paciente antes de uploads deixa cadastro parcial | Baixa/Media (potencial) | RESOLVIDO |
| 119 | `npm audit` com vulnerabilidades transitivas moderadas/baixa | Baixa/Media | RESOLVIDO |
| 120 | Campos de versao aceitam zero/negativo em inserts diretos | Baixa (potencial) | RESOLVIDO |
| 121 | `access_logs.status` sem dominio fechado | Baixa | RESOLVIDO |

Auditoria 2026-06-17 (`relatorios/auditoria-2026-06-17-211918.md`).

| # | Achado | Severidade | Status |
|---|--------|-----------|--------|
| 122 | Consentimento LGPD imposto so no cliente mobile; API por token nao bloqueia e reconsentimento nao atinge sessoes ativas | Media | RESOLVIDO — residual web fechado em 2026-09-05 em requireUser/requirePermission/requireAdminGeral: action clinica, tres exports HTTP e duas paginas de impressao negam consentimento pendente; aceite mantem excecao explicita e autenticada |
| 123 | Mobile desloga em falha de rede/timeout/5xx durante o refresh, nao so em 401/403 | Baixa | RESOLVIDO |

Auditoria 2026-06-18 (`relatorios/auditoria-2026-06-18-025126.md`).

| # | Achado | Severidade | Status |
|---|--------|-----------|--------|
| 124 | Data de nascimento de profissional aceita entrada invalida e e descartada silenciosamente (null), divergindo de pacientes | Baixa | RESOLVIDO |
| 125 | Endereco composto pode exceder `endereco varchar(255)` e gerar erro 22001 nao tratado no save de profissionais | Baixa (potencial) | RESOLVIDO |

Auditoria 2026-07-07 (`relatorios/auditoria-2026-07-07-192036.md`).

| # | Achado | Severidade | Status |
|---|--------|-----------|--------|
| 126 | Falha no pre-preenchimento da edicao de evolucao (mobile) deixa o form vazio e salvavel — PUT pode sobrescrever o payload clinico existente | Media (potencial) | RESOLVIDO |
| 127 | Agenda mobile nao recarrega ao voltar do form de evolucao; card recem-evoluido reabre em modo criacao e cai no 409 | Baixa | RESOLVIDO |
| 128 | Web sem headers de seguranca HTTP (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, CSP) | Baixa | RESOLVIDO |

Revisao 2026-08-03 (analise de pendencias, sem relatorio formal em `relatorios/`).

| # | Achado | Severidade | Status |
|---|--------|-----------|--------|
| 129 | `npm audit` regrediu de 0 para vulnerabilidades critical/high por CVEs publicados apos a resolucao anterior | Alta | RESOLVIDO — reincidencia de 2026-08-23 fechada com Expo 57/RN 0.86.2, NanoID corrigido, 0 high/critical e gate de audit no CI; 10 moderadas do toolchain Expo permanecem sem correcao compativel |
| 130 | Politica de privacidade publica com `TODO(clinica)` visivel ao titular, operador Neon ausente da lista e transferencia internacional de dado sensivel nao declarada (LGPD art. 33) | Alta | RESOLVIDO |

Verificacao de seguranca 2026-08-04 (`relatorios/seguranca-2026-08-04-022911.md`),
commit do veredito `a841ce9`. Gate REPROVADO: 20 PASS, 3 PARCIAL, 1 FALHA, 7 N-A.

| # | Achado | Severidade | Status |
|---|--------|-----------|--------|
| 131 | Troca de senha revoga tokens mobile (claim `ver`) mas nao a sessao web: o JWT do NextAuth nao carrega nem confere `tokenVersion`, sobrevivendo ate o `maxAge` de 8h | Alta (historico); Media (residual) | RESOLVIDO — aceite residual fechado em 2026-09-05: pagina/Server Action revalidam sessao; web e POST /api/v1/consentimento gravam com predicado atomico de ativo/deletedAt/tokenVersion. Corrida com revogacao validada em PostgreSQL |
| 132 | CSP ausente (quesito D1); demais headers e HSTS confirmados na resposta de producao | Media | ABERTO (aceito) — CSP implantada em enforce; `'unsafe-inline'` em script-src/style-src aceito porque nonce exigiria middleware em todas as rotas, tornando dinamicas as paginas hoje estaticas (landing, /login, /privacidade). D1 segue PARCIAL por esse criterio |
| 133 | Fail-open do rate limit de login sem politica de degradacao escrita por rota nem controle compensatorio independente | Media | DOCUMENTADO — politica por operacao em `docs/seguranca-decisoes-auditoria.md`: login degrada, demais negam; o store e o proprio Postgres da app, entao nao ha caminho em que o contador caia com o login de pe |
| 134 | Lookup de role usa `ilike` com input nao escapado (`role` = `%` casa qualquer slug e o `limit(1)` sem `order by` escolhe arbitrario); exige admin-geral, entao e integridade e nao escalada | Baixa | RESOLVIDO |

Auditoria 2026-08-23 (relatorio externo
`C:\Codes\relatorios\autismcad\auditoria-2026-08-23-082111.md`).

| # | Achado | Severidade | Status |
|---|--------|-----------|--------|
| 135 | Seed troca senha de admin existente sem incrementar `tokenVersion` | Media | RESOLVIDO — update do superadmin incrementa a versao na mesma escrita e revoga sessoes anteriores; regressao valida o SQL gerado |
| 136 | Seed privilegiado aceita banco remoto sem confirmacao explicita | Media | RESOLVIDO — alvo e mascarado e banco remoto exige `--yes-prod` ou `SEED_CONFIRM=1` antes de conexao/escrita; alias raiz encaminha a flag |
| 137 | Limite de 20 MB e aplicado somente depois do upload ao R2 | Media | RESOLVIDO — presign exige tamanho entre 1 byte e 20 MB e inclui `content-length` na assinatura SigV4; clientes enviam `File.size` e a verificacao real no commit permanece como defesa adicional |
| 138 | Primitivos mobile omitem semantica essencial de acessibilidade | Media | RESOLVIDO — primitivos e chamadas `Pressable`/`Field` expoem nome, papel, selecao, disabled/busy e anuncios de erro; regressao estatica cobre todos os controles mobile |
| 139 | `API_V1_CORS_ORIGIN` esta fora do contrato central de configuracao | Baixa | RESOLVIDO — origem entrou no schema Zod central, proxy tipado, `.env.example` e `turbo.globalEnv`, preservando o fail-closed de producao |
| 140 | Filtro recorrente de pacientes nao excluidos nao tem indice parcial dedicado | Baixa (potencial) | RESOLVIDO — medicao read-only no banco configurado mostrou 52 linhas (39 ativas), tabela de 16 kB e listagens em 0,094/0,132 ms sem leitura fisica; o `Seq Scan` e adequado ao volume atual e um indice adicional nao teria beneficio mensuravel |
| 141 | Runner/actions, Node e EAS CLI permanecem mutaveis ou abertos | Baixa | RESOLVIDO — Ubuntu, actions por SHA, Node, npm e EAS CLI foram fixados; engines e `.nvmrc` documentam as linhas Node suportadas e regressao protege o contrato |
| 142 | Texto branco sobre cores de marca falha contraste WCAG AA | Media | RESOLVIDO — token `#333333` substitui texto branco nas acoes laranja e gradientes claros; teste de luminancia confirma pelo menos 4,5:1 nos sete fundos/estados versionados |
| 143 | Campos de evolucao e dialogos nao completam nome/foco/teclado acessiveis | Media | RESOLVIDO — campos receberam rotulos associados e dialog compartilhado implementa nome acessivel, foco inicial, trap/restauracao, Escape e fechamento por backdrop |
| 144 | Engajamento e fechado na UI, mas backend aceita texto livre e relatorio ignora valores desconhecidos | Media (potencial) | RESOLVIDO — payload v2 exige `sim|nao` nas novas gravacoes web/API/mobile; updates legados so preservam valores existentes e o relatorio exibe a contagem ignorada |
| 145 | Expo Doctor aponta drift, duplicidade nativa e regressao de memoria do Hermes | Media (potencial) | RESOLVIDO — novo drift de sete patches fechado em 2026-09-05: Expo 57.0.20/RN 0.86.3, install --check e Doctor 21/21; bundles Android/iOS, build Android release x86_64 e smoke em emulador descartavel passaram. Nao e publicacao de APK nem compilacao iOS/Xcode |
| 146 | Preview sem override explicito herda a API de producao | Media (potencial) | RESOLVIDO — perfil EAS usa ambiente preview e app config falha fechado sem URL ou quando ela coincide com producao; 4 testes e bundle Android validam o isolamento |
| 147 | Permissao `consultas:presence` ficou inerte: nenhum caminho de codigo a exige | Baixa | RESOLVIDO (codigo/local) — remocao confirmada pelo usuario em 2026-09-05. Retirada da UI, aliases, seed e catalogo/carregamento de acesso; presence nao concede edit. Migration DML 0012 remove somente essa permissao e seus vinculos, validada duas vezes no banco descartavel. Aplicacao em banco persistente pendente e fora deste escopo |
| 148 | Exclusao unitaria de atendimento nao validava posse do registro | Media | RESOLVIDO — `41cdee2` aplica em `excluirAtendimentoAction` a mesma guarda da edicao (papel efetivo PROFISSIONAL so remove atendimento proprio), com teste de regressao. Exposicao anterior: profissional podia soft-deletar atendimento de colega em paciente compartilhado chamando a server action; nao alcancavel pela tela. Escapou do gate `relatorios/seguranca-2026-09-01-151704.md`, que leu o quesito C2 so no caminho de edicao |

## Resolucao da auditoria 2026-09-04, validada em 2026-09-05

Origem: `C:\Codes\relatorios\autismcad\auditoria-2026-09-04-215138.md`, com adendo
de resolucao no proprio arquivo. HEAD inicial/final: `85e6eff1232ac2913b522f942da3bc104c06da87`.
O working tree inicial estava limpo. Nenhum commit, push, deploy ou alteracao em
banco/R2 persistente foi feito. RESOLVIDO nesta rodada significa **codigo e
validacoes locais concluidos**, nao correcao ja publicada. Os residuos de #102,
#113, #114, #122, #131, #145 e #147 foram conciliados nas linhas existentes acima.

| # | Achado | Severidade | Status |
|---|--------|-----------|--------|
| 16 | Finalizacao por salvarDocumentoProntuarioAction contornava prontuario:finalize (residual historico) | Alta | RESOLVIDO — criar ou versionar com status Finalizado exige tambem finalize; quatro testes invocam a action e provam zero escrita sem a permissao, preservando as guardas de paciente e imutabilidade |
| 149 | P149: chave R2 de arquivo aceito excedia varchar(255) | Media | RESOLVIDO — um UUID e preservado na promocao; presign limita filename conservando extensao conforme o ID/tipo; chaves temporaria/final verificadas antes da transferencia. Teste inclui filename de 180 caracteres e maior ID seguro |
| 150 | P150: cadastro antigo restaura referencia de anexo removido | Media | RESOLVIDO — cadastro nao escreve foto/laudo/documento; commit exclusivo com lock da linha, idempotencia e limpeza que revalida referencia sob lock. PostgreSQL cobre commits concorrentes, cadastro antigo e rollback seguido de commit rival |
| 151 | P151: delete R2 parcial reporta sucesso falso | Media | RESOLVIDO — Errors por objeto entram em failed; so transitorios recebem ate duas repeticoes. Cleanup informa contagens reais, e GET/POST do cron retornam 502 quando ha falha. Sem exclusao real em R2 |
| 152 | P152: Unicode aceito nos dados quebra PDF | Media | RESOLVIDO — Noto Sans/fontkit locais com tracing, NFC, quebra de texto e fallback explicito [U+XXXX] com legenda; PDF sintetico de duas paginas renderizado e revisado visualmente, sem alterar dado clinico |
| 153 | P153: CSP bloqueia ViaCEP no cadastro profissional | Media | RESOLVIDO — formulario usa /api/cep/[cep] e campo cidade; handler limita provedor a cinco segundos. Chromium com CSP enforce confirma preenchimento, preservacao manual e bloqueio de origem externa |
| 154 | P154: decoder vulneravel no parsing do Expo Router | Media | RESOLVIDO — decode-uri-component 0.5.0 com adaptador CJS limitado em query-string 7.1.3, aplicado por npm ci. Contratos/malformados, Metro Android/iOS, Hermes/build nativo e deep link de agenda validados. Restam somente as dez moderadas de tooling ja registradas em #129 |
| 155 | P155: refresh pendente restaura sessao apos logout mobile | Media | RESOLVIDO — geracao/cancelamento de sessao e fila SecureStore; testes com AuthProvider real cobrem hidratacao, refresh, login A/B, escrita pendente, consentimento tardio e single-flight. Emulador confirmou login, refresh 401->200 e logout, com deep link protegido voltando ao login |
| 156 | P156: testes nao exercitam fronteiras de autorizacao/integracao | Media | RESOLVIDO — harness executa modulos reais, React real, HTTP, PostgreSQL com pools independentes e Chromium; CI ganhou PostgreSQL e browser. Testes sem cache; nao se usa contador de testes como substituto de cobertura por risco |
| 157 | P157: cabecalho do ledger anuncia numero ja ocupado | Baixa | RESOLVIDO — removido contador manual; IDs 149-157 reservados apos verificar maximo 148 no ledger/git. Numeracao continua derivada do maior ID existente, sem renumerar historico |

Validacoes: baseline **123 testes (117 web + 6 mobile)**; final **171 testes
(155 web + 16 mobile)**, mais **8 PostgreSQL + 2 browser = 181**, sem falhas ou skips.
Typecheck nos cinco workspaces, lint, build de producao, Drizzle check offline,
Expo check/Doctor e compilacao Android passaram. Evidencias externas em
`C:\Codes\relatorios\autismcad\evidencias-resolucao-20260905\`.

Pendencias operacionais: publicar somente com autorizacao; coordenar a migration
0012 de limpeza de ACL como contract apos adocao do codigo que nao usa a permissao,
com backup das linhas de permissao/vinculos. Nao usa DROP/ALTER nem toca dados
clinicos. Nenhuma env nova de producao; manter transacoes reais e assets de fontes
no deploy, atualizar os clientes mobile e recarregar abas antigas. Os achados
#81/#132 aceitos e #133 documentado continuam com suas decisoes, sem reabertura.

### Publicacao autorizada em 2026-09-05

Na etapa seguinte, o usuario autorizou commit e push em `main`, com testes na
versao web e **sem lancar o app mobile**. O codigo mobile corrigido integra o
commit, mas nao ha release EAS, APK/AAB distribuido ou publicacao em loja.

Preflight: `main` e `origin/main` sincronizados no HEAD inicial acima; 171 testes,
typecheck nos cinco workspaces, lint, dois testes Chromium e build web de producao
reexecutados com sucesso. O build usou copia isolada, sem `.env` real e com valores
sinteticos. Nenhuma alteracao em banco/R2 persistente foi executada.

Vercel conferida no projeto `autismcad`: branch `main`, Root Directory `apps/web`,
Node 24.x e comandos padrao de install/build. O build nao chama migrations ou seed,
e nao ha env nova exigida por este diff. A migration 0012 **nao e pre-requisito do
codigo**: o carregamento/catalogo ja ignora a permissao legada mesmo se sua linha
continuar no banco. Aplicar essa limpeza somente em etapa contract posterior,
autorizada e com backup dos vinculos. O push nao executa essa limpeza.

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
| 80 | `ac071c8` | store de refresh tokens com rotacao/revogacao | RESOLVIDO — claim + INSERT do novo JTI usam transacao obrigatoria; regressao comprova rollback do claim quando o INSERT falha e a politica pos-commit esta documentada |
| 99 | `ac071c8` | npm audit zerado via overrides, junto com o 119 | RESOLVIDO |
| 81 | `ac071c8` | decisao de seguranca aceita (CORS coringa so fora de producao; documentada) | ABERTO (aceito) |
| 84, 97 | `301889d` | mobile: guarda central de rotas autenticadas | RESOLVIDO |
| 93, 94 | `cf7cdf8` | web: UI de pacientes/profissionais por permissao efetiva | RESOLVIDO |

### Numeros sem rastro no git (5, 8, 21, 22, 23, 62, 68, 72, 73, 82, 92, 95)

Provavelmente achados de relatorios locais (gitignored) que foram nao acionaveis,
renomeados ou marcados "sem inconsistencia". Status DESCONHECIDO — nao re-verificar
salvo se reaparecerem numa auditoria futura.
