# Backup completo para recuperação de desastre — 2026-10-06

O conjunto de recuperação foi criado em
`C:\Users\pepg\OneDrive\Projetos\autismcad\2026-10-06_04-20-47`.
A cópia local foi conferida por SHA-256; a sincronização efetiva com a nuvem
OneDrive e o download remoto do conjunto ainda não foram verificados.

## Artefatos

- `autismcad-completo-2026-10-06_04-20-47.zip`: 35.503.292 bytes.
- `GUIA-RESTAURACAO.txt`: sequência detalhada para reconstruir os serviços.
- `manifesto.json`: conteúdo, origem, inventários e limites.
- `VERIFICACAO-FINAL.json`: resultados das verificações locais.
- `SHA256SUMS.txt`: hashes dos quatro artefatos anteriores.

SHA-256 do ZIP:

```text
2ffa99c2823cc3ae18b6e220f28acdb2b6f69c9b0e1f4798ce8b4c07ca6d63e0
```

O ZIP contém dados clínicos, arquivos `.env` reais e credenciais de recuperação.
Os artefatos ficam fora do Git; este registro não contém valores de credenciais.

## Conteúdo preservado

- Projeto web/mobile e pacotes: 2.539 arquivos, incluindo `.git`, arquivos
  ocultos, documentação, assets, configuração local e alterações não commitadas.
- Histórico Git adicional em bundle e patch das alterações locais. O HEAD
  preservado é `8de91c726f30a1a6276f218a62b5840a6d8491a3`, em `main`.
- Banco de produção: dump PostgreSQL custom completo, 19 tabelas, 13.687
  registros, 15 sequências, funções, triggers, índices, constraints, RBAC,
  usuários e journal Drizzle. Fonte PostgreSQL 17.11, ferramenta `pg_dump` 17.10.
  O snapshot foi iniciado em 2026-10-06, aproximadamente às 04:25:19 de Cuiabá.
- Os 27 objetos do R2, com bytes, metadados e mapa das chaves originais. Todas
  as 27 referências de foto/laudo/documento do snapshot foram encontradas.
- Variáveis e configuração Vercel de Production, Preview e Development,
  domínios, exportação DNS BIND, política CORS e estado administrativo do R2.
- Chave de assinatura Android de produção e configuração baixadas do EAS,
  certificado verificado, identidade do projeto e versionCode remoto 1.

O conjunto preserva o estado dessa data; não contém alterações posteriores.
Este commit de documentação ocorre depois do snapshot do código.

## Verificações concluídas

- Dump restaurado em PostgreSQL local inicialmente vazio e descartável.
  Contagens e hashes dos conteúdos de todas as tabelas, sequências e estrutura
  lógica foram comparados com o snapshot de produção.
- Funções, triggers, índices, constraints e políticas conferidos. Na comparação
  de metadados, apenas lacunas físicas de posição de colunas removidas e casts
  equivalentes de arrays de constantes `varchar`/`text` foram normalizados.
- Todos os arquivos copiados foram comparados por SHA-256.
- ZIP lido integralmente e extraído: 2.631 arquivos; 2.630 checksums individuais
  mais a própria lista de checksums, também conferida.
- Projeto restaurado a partir do ZIP, hashes comparados, HEAD conferido e
  `git fsck` aprovado. Clone independente do bundle e aplicação do patch local
  com `git apply --check` aprovados.
- R2 conferido por ETag, tamanho e SHA-256; listagens inicial e final idênticas,
  com zero referências do banco ausentes no conjunto.
- Certificado do keystore Android exportado corresponde ao registrado no EAS.
- ZIP e demais artefatos no destino local OneDrive conferidos por SHA-256.

Produção foi somente lida: nenhuma migration, alteração de dados, configuração
administrativa ou publicação mobile foi executada pelo procedimento de backup.

## Recuperação

Começar pelo `GUIA-RESTAURACAO.txt` ao lado do ZIP. Após conferir seu hash e
extrair em pasta nova, seguir os scripts internos de `recuperacao/`:

1. `verificar-integridade.ps1`: conferir todos os arquivos extraídos.
2. `restaurar-projeto.ps1`: copiar para um destino novo/vazio e validar o Git.
3. Reinstalar dependências e preparar endpoints novos antes de iniciar serviços.
4. `restaurar-banco.ps1`: importar em banco novo/vazio, com transação e parada
   no primeiro erro; `verificar-banco.cjs` compara dados e estrutura ao snapshot.
5. `restaurar-r2.cjs`: restaurar as chaves e metadados em bucket novo/vazio e
   conferir os bytes; reaplicar a política CORS e as regras registradas.
6. Reconfigurar os ambientes Vercel, domínio/DNS e credenciais Android conforme
   o guia; validar os fluxos antes de liberar o uso.

Antes do passo 3, aplicar a atualização de `source-map-js` de 1.2.1 para 1.2.2,
descrita em [dependências e segurança](dependencias-seguranca.md). O lockfile
preservado no ZIP é anterior a essa correção de segurança.

Os scripts de restauração recusam os endpoints originais de produção e destinos
ocupados. O dump já restaura o schema e o journal: não executar migrations ou
seeds antes da importação. O fluxo posterior continua sendo `db:migrate`,
conforme [operação do banco](banco-operacao.md); `db:push` permanece desabilitado.

## Limites

- Dependências, caches e builds regeneráveis foram excluídos; o manifesto lista
  cada diretório. Reinstalação exige npm e imagens Docker disponíveis. O conjunto
  não é uma imagem offline do computador.
- Contas/MFA, propriedade do domínio e infraestrutura dos provedores dependem de
  recuperar o acesso ou recriar os serviços. Credenciais Apple/iOS não foram
  exportadas; a verificação de assinatura cobre Android.
- O ensaio cobriu banco e arquivos locais. Implantação completa em nova cloud,
  login clínico na aplicação restaurada e upload de ensaio para R2 não foram
  realizados.
- Banco e R2 não compartilham transação. As referências do snapshot foram
  conferidas contra os objetos preservados, e o bucket permaneceu estável
  durante a captura.
- Sincronização e restauração remota do OneDrive ainda não foram verificadas.

As evidências detalhadas ficam em `verificacao/` dentro do ZIP, incluindo
`restauracao-banco.json`, inventários e o procedimento usado para criar o conjunto.
