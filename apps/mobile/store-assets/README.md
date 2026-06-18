# Store Assets — Google Play

Assets gráficos para a ficha do app na Google Play Store (`com.autismcad.app`).
Cole aqui os arquivos finais de cada tipo, na subpasta correspondente.

Marca de origem: `apps/web/public/girassois.svg` / `sunflower-svgrepo-com.svg`.

## Estrutura

| Pasta                 | Asset                  | Especificação                                                              | Obrigatório |
|-----------------------|------------------------|---------------------------------------------------------------------------|-------------|
| `icon/`               | Ícone da ficha         | 512 × 512 px, PNG 32-bit com alpha, ≤ 1 MB                                 | Sim         |
| `icon/`               | Ícone do app (adaptive)| Foreground + background, 1024 × 1024 px PNG (gerado pelo Expo)             | Sim         |
| `feature-graphic/`    | Feature graphic        | 1024 × 500 px, PNG ou JPG (sem transparência), ≤ 15 MB                     | Sim         |
| `screenshots/phone/`  | Telefone               | 2 a 8 imagens, 16:9 ou 9:16, lado entre 320 e 3840 px, PNG/JPG            | Sim (≥ 2)   |
| `screenshots/tablet-7/`  | Tablet 7"           | mesmas regras de proporção/tamanho                                         | Opcional    |
| `screenshots/tablet-10/` | Tablet 10"          | mesmas regras de proporção/tamanho                                         | Opcional    |

## Notas

- O ícone e a tela inicial do **app** são configurados em `app.json` (`expo.icon`,
  `expo.android.adaptiveIcon`). Já apontados para `icon/icon-1024.png` e
  `icon/adaptive-foreground-1024.png` (fundo `#0e1626`).
- Os PNGs aqui são gerados por `_source/generate.mjs` a partir do girassol da marca
  (`apps/web/public/sunflower-svgrepo-com.svg`). Rode da raiz:
  `node apps/mobile/store-assets/_source/generate.mjs`.
- Mantenha os fontes editáveis (SVG, Figma, .ai) em `_source/` para regerar quando preciso.
- A ficha de textos (descrição, privacidade, data safety) NÃO fica aqui — é tratada
  pela skill `lancamento-playstore`.
