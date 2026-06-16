# AutismCAD Mobile (Expo)

App Android (depois iOS) para profissionais registrarem evoluções e responsáveis verem
devolutivas. Consome a API `/api/v1` do `apps/web` por token Bearer.

## Pré-requisitos
- API rodando: na raiz do monorepo, `npm run dev -w @autismcad/web` (porta 3000).
- Android Studio (emulador) ou um device físico com Expo Go / dev build.

## Configurar a URL da API
`app.json > expo.extra.apiBaseUrl` hoje aponta para producao (`https://www.girassois.com.br`).
Para desenvolvimento local, ajuste temporariamente conforme o alvo:
- Emulador Android: `http://10.0.2.2:3000` (10.0.2.2 = host da maquina).
- Device fisico: `http://<IP-da-sua-maquina>:3000` (mesma rede Wi-Fi).

## Rodar (dev)
```
npm install                # na raiz (instala o workspace mobile)
npm run android -w @autismcad/mobile
```
Como `expo-secure-store` é um módulo nativo, use um **dev build** (não o Expo Go padrão):
```
npx expo run:android       # gera e instala o dev build no emulador/device
```
ou via EAS: `eas build --profile development --platform android`.

## Fluxos
- **Profissional**: login -> Agenda do dia -> toca num atendimento -> formulario de evolucao (titulo, conduta, descricao, linhas de metas/desempenho e comportamentos) -> Salvar.
- **Responsavel**: login -> Pacientes vinculados -> Devolutiva (indicadores, resumo, observacoes e evolucoes), renderizada nativamente.
- **Consentimento**: tela dedicada em `app/consentimento.tsx`, consumindo `/api/v1/consentimento`.

## Estrutura
- `app/` — telas (Expo Router): `login`, `agenda`, `evolucao`, `pacientes`, `devolutiva`, `consentimento`.
- `src/auth/AuthContext.tsx` — tokens em `expo-secure-store`, refresh automático em 401.
- `src/api/client.ts` — cliente HTTP; `src/api/types.ts` — tipos das respostas.
- `src/domain/evolucao.ts` — opções e construção do payload (espelha o form web).
- `src/ui.tsx` — kit de UI.
