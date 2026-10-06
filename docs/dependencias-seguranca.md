# Dependencias: correcoes de seguranca em 2026-10-05

Next.js e eslint-config-next foram atualizados de 16.3.4 para 16.3.8.
O limite minimo corrigido para o alerta critico GHSA-vcvr-r3jv-pc5j e 16.3.6.
`brace-expansion` usa overrides compativeis com cada major: 1.1.21 e 5.0.12.
Expo permanece no SDK 57 e React/ReactDOM em 19.2.3 no web e no mobile.
O check oficial do Expo exigiu patches compativeis: expo 57.0.26,
expo-constants 57.0.20 e expo-router 57.0.24, incluidos nesta entrega.

## Atualizacao de source-map-js em 2026-10-06

A CI do commit `968f4fd` bloqueou a versao transitiva 1.2.1 pelo aviso alto
[GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)
(CVE-2026-93749): offsets de mapas indexados podiam bloquear o event loop.
O lockfile agora usa 1.2.2, release corrigida e compativel com os intervalos
dos consumidores. Nao foi necessario adicionar override ou alterar o gate.
A [release upstream](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2)
tambem corrige a execucao no browser sob CSP sem unsafe-eval.

O backup de 2026-10-06_04-20-47 preserva o estado anterior, incluindo 1.2.1.
Depois de restaurar esse snapshot, aplicar esta atualizacao de seguranca
antes da instalacao e publicacao do aplicativo.

## Atualizacao de sharp e shell-quote em 2026-10-06

A CI do commit `1745df2` encontrou dois novos avisos sem mitigacao:

- `sharp` 0.35.4: aviso alto
  [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w)
  na dependencia nativa librsvg. O override minimo passa a `^0.35.5`;
  o lockfile inclui os binarios sharp 0.35.5 e sharp-libvips 1.3.4,
  com librsvg 2.63.2 corrigido.
- `shell-quote` 1.10.0: aviso critico
  [GHSA-pqg4-j6r4-53mv](https://github.com/advisories/GHSA-pqg4-j6r4-53mv)
  por quebra de linha em argumentos depois de um token de comentario.
  O lockfile passa a 1.12.0, que inclui a correcao publicada em 1.11.0.
  A faixa `^1.6.1` de react-devtools-core ja aceita essa versao;
  nao e necessario adicionar outro override nem atualizar React Native.

`scripts/security/dependency-upgrades.test.cjs` verifica a rejeicao das quatro
quebras de linha do aviso, preserva argumentos validos e exercita a conversao
SVG/PNG com a biblioteca nativa corrigida. O gate de dependencias permanece
inalterado; os patches de braces e node-forge continuam obrigatorios.
Snapshots anteriores com sharp 0.35.4 ou shell-quote 1.10.0 devem receber
esta atualizacao antes de serem publicados novamente.

O check oficial de compatibilidade encontrou tambem novos patches do SDK 57:
expo 57.0.27, expo-constants 57.0.21, expo-linking 57.0.12 e expo-router 57.0.25.
Esses quatro pacotes foram alinhados para preservar o gate mobile do CI;
React, React Native e a major do SDK permanecem nas versoes anteriores.
O lockfile preserva os overrides anteriores de decode-uri-component 0.5.0
e uuid 11.1.1; a instalacao limpa aplica tambem o adaptador de query-string.

## Correcoes locais enquanto nao ha release upstream

| Pacote | Aviso exato | Correcao |
| --- | --- | --- |
| braces 3.0.3 | GHSA-vfj7-8cjw-p6xm | Profundidade maxima 128 no parser e nos walkers, inclusive AST fornecida diretamente. |
| node-forge 1.4.0 | GHSA-86w9-cpqp-85rv | DigestAlgorithm aceita somente OID e NULL vazio opcional; rejeita filhos ignorados pelo validator ASN.1. |

`patch-package --error-on-fail` aplica os patches em toda instalacao normal
(`npm ci` inclusive) e falha se eles nao puderem ser aplicados. Instalar com
`--ignore-scripts` nao e um fluxo valido de entrega.

Os testes exercitam globs usados pelo tooling, ranges e escapes; recusam strings
e ASTs profundamente aninhadas em processo com timeout; preservam assinaturas
SHA256 validas com/sem NULL e recusam tres variantes malformadas. Controles com
a correcao removida reproduzem o stack overflow e a aceitacao das assinaturas
malformadas. Todos os dados e chaves desses testes sao sinteticos.

## Gate do CI

Use `npm run audit:dependencies`. Ele executa `npm audit --json` incluindo dev,
verifica copias e versoes no lockfile e na instalacao, SHA256 do codigo corrigido
e dos patches (normalizado para LF), e executa os testes de regressao.
Somente os dois URLs GHSA acima podem ser classificados como corrigidos localmente.
Cada cadeia transitiva precisa terminar exclusivamente nesses avisos verificados;
ciclos de dependencias do Expo/Metro nao dispensam a verificacao das folhas.
Criticos, novos avisos altos, versoes/copias/hashes diferentes, falhas de rede,
JSON invalido ou regressao reprovada bloqueiam o CI.

O audit bruto ainda informa 23 entradas altas herdadas desses dois avisos e zero
criticas neste snapshot. Isso nao equivale a `npm audit` sem alertas. O gate
informa explicitamente a contagem bruta e a cobertura pelos patches locais.

Quando houver versao publicada corrigida, atualizar o pacote/cadeia compativel,
remover seu patch e entrada em `scripts/security/patched-advisories.json`, e
adaptar os testes para a implementacao upstream. Nao atualizar hashes somente
para fazer o gate passar: revisar o diff e a cobertura das regressões primeiro.
Rodar audit, instalacao limpa, lint, typecheck, testes, build, browser,
compatibilidade Expo/doctor e integracao em PostgreSQL descartavel antes de push.

## Fontes primarias

- [Next.js: aviso critico e versoes corrigidas](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j).
- [braces: aviso sem release corrigido](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) e [issue upstream #70](https://github.com/micromatch/braces/issues/70).
- [node-forge: aviso](https://github.com/advisories/GHSA-86w9-cpqp-85rv), [reproducao upstream #1149](https://github.com/digitalbazaar/forge/issues/1149) e [proposta #1152 ainda nao integrada](https://github.com/digitalbazaar/forge/pull/1152).
