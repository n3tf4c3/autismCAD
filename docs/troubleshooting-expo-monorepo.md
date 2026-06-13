# Troubleshooting: Expo (React Native) em monorepo npm workspaces

Pegadinha recorrente em projetos Next.js (web) + Expo (mobile) no mesmo monorepo npm.
Descoberto no autismcad em 2026-06-13, comparando com o tizerguide (mesmo padrão, mas já
em SDK 56 / React 19 — por isso lá nunca quebrou).

## Sintoma

Build do APK/AAB (ou `npx expo export -p android`) falha na task
`:app:createBundleReleaseJsAndAssets` (Metro bundling) com algo como:

```
Error: Unable to resolve module ./index.js from C:\Codes\<repo>/.:
None of these files exist:
  * ..\..\node_modules\expo-router\entry.js(...)
  * ..\..\node_modules\expo-router\entry.js
```

(o caminho pode ser `./node_modules/expo-router/entry.js` ou o seu entry). O detalhe-chave:
o módulo é resolvido **a partir da raiz do monorepo**, e os arquivos buscados não existem lá.

## Causa-raiz

O app mobile (`apps/mobile`) usa um **React de major diferente** do app web (`apps/web`).
Exemplo real: Expo SDK 52 fixa **React 18.3.1**, enquanto o Next/web usa **React 19.2.3**.

Com Reacts conflitantes, o **npm workspaces não consegue hoistear** as deps do mobile para o
`node_modules` da raiz — ele as **aninha** em `apps/mobile/node_modules`. O Metro/Expo calcula
a raiz do servidor (`getMetroServerRoot` → raiz do workspace) e relativiza o entry contra
`apps/mobile`, mas resolve contra a raiz, assumindo que as deps estão hoisteadas. Como estão
aninhadas, a resolução do entry quebra.

Técnico: `@expo/metro-config` define `server.unstable_serverRoot = getMetroServerRoot(projectRoot)`,
que retorna a raiz do workspace, a menos que `EXPO_NO_METRO_WORKSPACE_ROOT=1`.

## Diagnóstico rápido

```bash
# As duas devem ser IGUAIS, e NÃO deve existir cópia aninhada no app:
node -e "console.log('root ', require('./node_modules/react/package.json').version)"
node -e "console.log('mobile', require('./apps/mobile/node_modules/react/package.json').version)" \
  || echo "mobile react HOISTEADO (bom)"
```

Se a segunda linha imprime uma versão (cópia aninhada) diferente da raiz → é este problema.

## Fix recomendado: alinhar o React

Use um **Expo SDK cujo React bata com o do web**. Web em React 19 → **Expo SDK 56**
(RN 0.85, React 19.2.3). Fixe `react` na MESMA versão exata do web.

1. `apps/mobile/package.json`: `expo: ~56.x`, `react: <mesma versão exata do web>`,
   `react-native: 0.85.x`; alinhe as libs `expo-*`/`react-native-*` com `npx expo install --fix`.
2. Limpe e regenere o lock:
   `rm -rf apps/mobile/node_modules apps/mobile/android package-lock.json && npm install`.
3. Confirme o hoisting (diagnóstico acima).
4. `metro.config.js` padrão de monorepo: `watchFolders = [raiz]`,
   `nodeModulesPaths = [app/node_modules, raiz/node_modules]`. **NÃO** use
   `disableHierarchicalLookup = true`.
5. `main: "expo-router/entry"` (sem shim de index.js).
6. Valide o bundle antes do build nativo: `npx expo export -p android` (deve gerar o `.hbc`).
7. Build: `npx expo prebuild --clean -p android` + `cd android && ./gradlew assembleRelease`
   (ou EAS `--profile preview` para APK interno).

## Workaround (se NÃO puder alinhar o React)

Force o Expo a tratar o app como raiz do Metro:
`EXPO_NO_METRO_WORKSPACE_ROOT=1` no ambiente do build (faz `getMetroServerRoot` retornar o
projeto), mantendo `watchFolders`/`nodeModulesPaths` apontando pra raiz no `metro.config.js`.
É gambiarra: frágil e pode voltar a quebrar a cada reinstalação. Prefira alinhar o React.

## Por que "só funciona" em alguns monorepos

Quando web e mobile usam o MESMO React (mesma versão exata), o npm hoisteia tudo pra raiz, as
deps não ficam aninhadas e a resolução do entry funciona sem config extra. O setup padrão do
Expo monorepo depende disso — não havendo conflito de React.

## Dica de prevenção

Ao escolher o Expo SDK do app mobile, cheque o React que ele fixa e **case com o do web**:
SDK 52 → React 18.3; SDK 54+ → React 19. Mantenha `react`/`react-dom` na mesma versão exata
entre `apps/web` e `apps/mobile`.

## Bônus (Windows): erro de path > 260 chars no build C++

Resolvido o entry, no **Windows** o build nativo pode falhar na task
`:app:buildCMakeRelWithDebInfo[<abi>]` com:

```
ninja: error: Stat(...react-native-gesture-handler/.../*ShadowNode.cpp.o):
Filename longer than 260 characters
```

Causa: o ninja embutido no **CMake 3.22.1** do Android SDK é o **1.10.2**, que **não é
long-path-aware** (ignora o `LongPathsEnabled=1` do Windows). O caminho do `.o` intermediário
(`.cxx\...\C_\...\node_modules\react-native-gesture-handler\...\*ShadowNode.cpp.o`) passa de
260 chars no new-arch/codegen. Encurtar a pasta do projeto não resolve (o path tem ~347 chars).

Fix: instalar um CMake com ninja ≥ 1.11 e fixá-lo no módulo do app:

```bash
sdkmanager "cmake;3.31.6"   # traz ninja 1.12.1, long-path aware
```

Em `apps/mobile/android/app/build.gradle`, dentro de `android { }`:

```gradle
externalNativeBuild { cmake { version "3.31.6" } }
```

Limpe o `.cxx` antigo e rebuilde: `rm -rf app/.cxx && ./gradlew assembleRelease`.

Como `android/` é regenerado pelo `expo prebuild` (CNG), essa edição do gradle é um **stopgap
local** — não sobrevive a um `prebuild --clean`. Alternativa definitiva: **EAS Build** (roda em
Linux, sem o limite de 260) — é o caminho que o Tizer usa.

