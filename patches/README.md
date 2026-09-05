# Adaptador temporario do Expo Router

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
