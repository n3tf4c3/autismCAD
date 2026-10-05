# Patches temporarios de dependencias

## Expo Router

O Router 57 usa os exports nomeados CommonJS de `query-string@7.1.3`.
Seu decoder antigo foi substituido por `decode-uri-component@0.5.0` para
corrigir GHSA-vcc3-ghjq-m6fr. A versao nova e ESM; o patch adapta somente
o import (`.default`) e o contrato da dependencia. Node 22.22/24.11 e Metro
usados pelo projeto suportam essa interoperabilidade.

`npm ci` aplica o patch e falha se ele deixar de encaixar. Os testes exercitam
parse/stringify, entrada malformada em processo com timeout e contratos do Router.
Ao atualizar Router/query-string, revisar e remover este adaptador quando a cadeia
upstream ja consumir o decoder corrigido. Nao trocar por query-string 9 sem adaptar
os imports do Router: seus exports sao diferentes.

## Seguranca: braces e node-forge

`braces@3.0.3` limita a profundidade a 128 no parser e nos tres walkers
(compile/expand/stringify), inclusive quando recebem AST diretamente. Corrige
o esgotamento de pilha descrito em GHSA-vfj7-8cjw-p6xm. O limite nao pode ser
aumentado por uma opcao fornecida pelo chamador.

`node-forge@1.4.0` valida o conteudo completo da sequencia DigestAlgorithm:
somente OID e NULL vazio opcional. A contagem de elementos segue a proposta
upstream #1152; a verificacao do NULL tambem rejeita `[OID, garbage]` e NULL
com bytes extras, que a validacao ASN.1 permissiva deixa passar.

As versoes publicadas ainda nao corrigem esses dois avisos. Nao alteramos a
versao declarada para esconder alertas: `npm audit` continua listando-os.
`npm run audit:dependencies` inclui dependencias de desenvolvimento e exige
versoes, copias e hashes exatos, alem dos testes reais de regressao, antes de
considerar somente os dois avisos especificos como corrigidos localmente.

Consulte [a politica de seguranca](../docs/dependencias-seguranca.md) para fontes,
checagens e retirada dos patches quando houver correcao publicada.
