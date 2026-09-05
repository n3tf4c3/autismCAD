# Regressao das fronteiras de auditoria

`npm test` executa os testes web/mobile sem cache. `load-source.cjs` compila os
modulos reais em memoria e substitui somente fronteiras explicitamente declaradas
por cada teste. Nao carrega `.env`, nao grava bundles e nao usa contas reais.

- `npm run test:integration`: PostgreSQL descartavel, com migrations SQL reais.
  Exige `AUDIT_ALLOW_DISPOSABLE_DB=1` e `TEST_DATABASE_URL` apontando para loopback
  e banco **autismcad_audit_test**. O teste limpa tabelas desse banco; nunca usar
  um proxy para banco persistente. Cada rival usa pool/conexao independente;
  `pg_stat_activity` comprova a disputa pelo lock. O controle negativo remove
  lock/revalidacao somente do bundle em memoria e reproduz a perda da invariante.
- `npm run test:browser`: instalar Chromium com `npx playwright install chromium`.
  Monta o formulario React real e o handler CEP real, com provedor e autenticacao
  sinteticos, sob os headers CSP do projeto. Nunca envia cadastro real.
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE` e um override local opcional do executavel.
- `AUDIT_EVIDENCE_DIR`: opcional no teste PDF para salvar o relatorio sintetico
  fora do repositorio e renderiza-lo para inspecao visual.
- `AUDIT_NATIVE_FIXTURE=1 node scripts/testing/native-fixture-server.cjs`: API
  local de smoke, sem banco/upstream, na porta 3107. Usar exclusivamente em
  emulador dedicado com `APP_VARIANT=preview`, `EXPO_NO_DOTENV=1` e
  `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3107`. HTTP no APK de teste exige
  cleartext somente na copia descartavel; nao alterar o app de producao.

O CI roda unidades, fronteiras HTTP/React, PostgreSQL e Chromium. O build nativo
deve ser refeito ao atualizar Expo/Router/RN. Bundle iOS no Windows nao substitui
compilacao/assinatura com Xcode. Os APKs sinteticos de smoke nao sao releases.
