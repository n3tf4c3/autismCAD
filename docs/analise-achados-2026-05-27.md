# Analise de Achados - 2026-05-27

Escopo: analise somente leitura do projeto `autismcad`, focada em inconsistencias, riscos e melhorias tecnicas.

## Verificacoes executadas

- `npm run lint`: passou com 1 warning.
- `npm test`: passou, 8/8 testes.
- Nao foram executados `build`, `typecheck` ou `db:check` para evitar risco de atualizar artefatos locais.

## Achados principais

### Alta - migrations parecem nao recriar o schema atual em banco limpo

Arquivos:

- `src/server/db/schema.ts:109`, `144`, `149`, `214`, `255`, `311`, `346`, `384`
- `src/server/db/migrations/0000_phase1_init.sql:1-40`
- `src/server/db/migrations/0003_terapeutas_ativo.sql:1`
- `src/server/db/migrations/0006_terapeutas_schema_compat.sql:1-37`

O schema Drizzle define tabelas centrais como `pacientes`, `terapias`, `paciente_terapia`, `terapeutas`, `atendimentos`, `anamnese`, `anamnese_versions`, `prontuario_documentos` e `evolucoes`, mas a migration inicial cria apenas RBAC/users basicos. Migrations seguintes ja assumem tabelas existentes, como `terapeutas`.

Risco: `drizzle-kit migrate` em ambiente novo pode falhar ou gerar banco incompleto.

Sugestao: gerar/revisar uma migration baseline coerente com o schema atual ou documentar claramente que essas migrations dependem de uma base preexistente.

### Alta - possivel associacao de chave R2 arbitraria em paciente

Arquivos:

- `src/server/modules/pacientes/pacientes.schema.ts:38-40`
- `src/server/modules/pacientes/pacientes.service.ts:315-317`, `347-349`
- `src/app/(protected)/pacientes/paciente.actions.ts:270-283`

`fotoAtual`, `laudoAtual` e `documentoAtual` sao aceitos como strings genericas e persistidos diretamente. Depois, `obterArquivoPacienteReadUrlAction` gera URL assinada para a chave salva.

Risco: um usuario com permissao de edicao pode associar uma chave R2 fora do namespace esperado do paciente e depois obter URL assinada de leitura.

Sugestao: validar tambem no fluxo de salvar que chaves persistidas pertencem a `pacientes/{pacienteId}/{kind}/...`; idealmente, centralizar essa validacao em helper unico.

### Alta/Media - relatorio evolutivo pode expor evolucoes de outros profissionais

Arquivo:

- `src/server/modules/relatorios/relatorios.service.ts:238-244`, `343-360`

O filtro de profissional e aplicado na consulta de atendimentos, mas a consulta de evolucoes filtra apenas por paciente e periodo.

Risco: para role `PROFISSIONAL`, um profissional vinculado ao paciente pode receber evolucoes feitas por outros profissionais do mesmo paciente.

Sugestao: aplicar `profissionalFiltro` tambem na consulta de `evolucoes` quando houver restricao por profissional.

### Media - `useEffect` com dependencias suprimidas em telas criticas

Arquivos:

- `src/app/(protected)/consultas/consultas.client.tsx:259-262`
- `src/app/(protected)/calendario/calendario.client.tsx:395-416`
- `src/app/(protected)/anamnese/[pacienteId]/anamnese-paciente.client.tsx:503-506`
- `src/app/(protected)/relatorios/devolutiva-mensal/devolutiva-mensal.client.tsx:375-378`
- `src/app/(protected)/relatorios/devolutiva-dia/devolutiva-dia.client.tsx:359-362`
- `src/app/impressao/devolutiva/devolutiva-impressao.client.tsx:729-732`
- `src/app/impressao/plano-ensino/plano-ensino-impressao.client.tsx:452-455`

Ha varios `eslint-disable-next-line react-hooks/exhaustive-deps` em efeitos que chamam funcoes de carregamento.

Risco: closures antigas, filtros desatualizados e bugs quando props/estado mudam.

Sugestao: mover logica de interacao para handlers, estabilizar dependencias quando necessario, ou carregar dados iniciais em Server Components quando o dado for previsivel.

### Media - componentes client importam modulos de `@/server/*`

Arquivos:

- `src/app/(protected)/pacientes/paciente-form.client.tsx:8`
- `src/app/(protected)/profissionais/profissional-form.client.tsx:9`
- `src/components/sidebar/sidebar.client.tsx:8`

Componentes `use client` importam schemas/funcoes localizados em `src/server`.

Risco: quebra da separacao client/server no App Router, aumento de bundle client e risco futuro de importar codigo incompatível com browser.

Sugestao: mover schemas/funcoes compartilhadas para `src/lib` ou outro diretorio neutro, mantendo `src/server` apenas para codigo server-only.

### Media - TOCTOU em exclusao de paciente e profissional

Arquivos:

- `src/server/modules/pacientes/pacientes.service.ts:386-415`
- `src/server/modules/profissionais/profissionais.service.ts:202-230`

Os fluxos leem `ativo` antes da transacao e depois executam `UPDATE` sem exigir `ativo = false` no `WHERE`.

Risco: em concorrencia, um registro pode ser reativado entre a checagem e o update e ainda assim ser excluido.

Sugestao: colocar a regra no proprio `WHERE` transacional, por exemplo exigindo `ativo = false` na atualizacao de soft-delete.

### Media - auditoria de vinculos de paciente nao e atomica

Arquivo:

- `src/server/modules/users/users.service.ts:255-343`, `364-432`

Alteracoes de usuario/vinculos ocorrem em uma transacao, mas o registro em `user_paciente_vinculos_audit` acontece depois, em outra transacao, e falhas sao apenas logadas.

Risco: vinculos podem ser removidos sem registro de auditoria caso a segunda operacao falhe.

Sugestao: se a auditoria for requisito de integridade/compliance, gravar a auditoria na mesma transacao da alteracao principal.

### Media - variaveis R2 e cron sao opcionais em producao

Arquivo:

- `src/lib/env.ts:21-30`

Variaveis como `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` e `CRON_SECRET` sao opcionais.

Risco: a aplicacao pode subir em producao sem capacidade de upload/cleanup, falhando apenas em runtime.

Sugestao: usar `superRefine` no schema de ambiente para exigir esses valores quando `NODE_ENV === "production"`.

### Media - ausencia de middleware central de autenticacao

Arquivos:

- Ausencia de `middleware.ts` ou `src/middleware.ts`
- `src/app/(protected)/layout.tsx:21-25`
- `src/app/impressao/devolutiva/page.tsx:15-18`

A protecao ocorre no layout do grupo protegido e manualmente em rotas fora dele, como `/impressao`.

Risco: uma nova rota fora do grupo protegido pode ser criada sem chamada explicita de autorizacao.

Sugestao: adicionar middleware com matcher cobrindo rotas protegidas, ou criar layout protegido especifico para `/impressao`.

### Baixa/Media - imagens usam `<img>` com lint suprimido e `next.config.ts` vazio

Arquivos:

- `next.config.ts:3-5`
- `src/app/(protected)/pacientes/[id]/page.tsx:196-197`
- `src/app/(protected)/relatorios/devolutiva-mensal/page.tsx:136-137`
- `src/app/(protected)/relatorios/devolutiva-dia/page.tsx:125-126`
- `src/app/impressao/plano-ensino/plano-ensino-impressao.client.tsx:581-582`
- `src/app/impressao/devolutiva/devolutiva-impressao.client.tsx:858-859`

O projeto usa `<img>` e suprime a regra do Next em alguns pontos. `next.config.ts` nao configura `images.remotePatterns` para URLs remotas/R2.

Risco: perda de otimizacao de imagem, sizing e protecao contra CLS.

Sugestao: configurar hosts permitidos em `next.config.ts` e migrar gradualmente para `next/image` onde fizer sentido.

### Baixa - warning de lint

Arquivo:

- `src/server/modules/prontuario/prontuario.service.ts:655`

O lint aponta `sortTs` como variavel nao usada no destructuring final.

Risco: baixo; gera ruido em CI e revisoes.

Sugestao: ajustar o destructuring ou configurar a regra para ignorar propriedades descartadas, conforme padrao do projeto.

### Baixa - cobertura de testes estreita

Arquivo:

- `src/tests/consultas.actions.auth.test.ts`

Existe apenas uma suite de testes cobrindo principalmente autorizacao das actions de consultas.

Risco: regressões em pacientes, prontuario, relatorios, R2 e RBAC podem passar despercebidas.

Sugestao: priorizar testes para autorizacao em relatorios/prontuario, validacao de upload R2 e regras de integridade em services criticos.

## Observacoes positivas

- O projeto tem scripts de `lint`, `typecheck`, `test` e CI configurado.
- Ha uso consistente de Server Actions com checagens de permissao em varios fluxos.
- Muitos services usam `runDbTransaction` com `mode: "required"` em operacoes importantes.
- Ha constraints relevantes no schema para integridade, como presenca/realizado e unicidade de evolucao por atendimento ativo.

## Prioridade sugerida

1. Corrigir baseline/migrations ou documentar dependencia de banco preexistente.
2. Fechar validacao de chaves R2 por paciente/kind.
3. Aplicar filtro de profissional tambem nas evolucoes do relatorio evolutivo.
4. Fortalecer configuracao de ambiente em producao para R2/cron.
5. Reduzir supressoes de `exhaustive-deps` nas telas com carregamento/filtros.
6. Separar codigo compartilhado client/server para fora de `src/server`.
7. Expandir testes de autorizacao e integridade nos modulos mais sensiveis.
