// Gera os assets da Play Store a partir do girassol da marca (SVG) usando sharp.
// Rodar a partir da raiz do monorepo: `node apps/mobile/store-assets/_source/generate.mjs`
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require(resolve(process.cwd(), "node_modules/sharp"));

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(here, "..");
const REPO = resolve(process.cwd());

// --- tokens da marca (iguais ao theme do app) ---
const TILE = "#0e1626";
const BG = "#0b1220";
const BRAND_STOPS = ["#f3d886", "#dccf96", "#aac7d4", "#7cc0d6", "#69c4ab"];

// Girassol: extrai o conteudo interno do SVG da marca (viewBox 0 0 512 512).
const raw = readFileSync(resolve(REPO, "apps/web/public/sunflower-svgrepo-com.svg"), "utf8");
const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
// Embute o girassol num grupo escalado/centrado dentro de um SVG de tamanho `box`.
function flower(cx, cy, size) {
  const s = size / 512;
  const tx = cx - size / 2;
  const ty = cy - size / 2;
  return `<g transform="translate(${tx},${ty}) scale(${s})">${inner}</g>`;
}

function brandGradientDef(id, angleDeg = 150) {
  const a = (angleDeg * Math.PI) / 180;
  const x2 = (0.5 + Math.cos(a) / 2).toFixed(4);
  const y2 = (0.5 + Math.sin(a) / 2).toFixed(4);
  const x1 = (0.5 - Math.cos(a) / 2).toFixed(4);
  const y1 = (0.5 - Math.sin(a) / 2).toFixed(4);
  const stops = BRAND_STOPS.map(
    (c, i) => `<stop offset="${(i / (BRAND_STOPS.length - 1)).toFixed(3)}" stop-color="${c}"/>`
  ).join("");
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`;
}

async function render(svg, outPath, w, h) {
  await sharp(Buffer.from(svg)).resize(w, h).png().toFile(outPath);
  console.log("wrote", outPath.replace(REPO, "."));
}

// 1) Icone full-bleed quadrado (app/launcher) — fundo TILE + girassol.
function iconSquare(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${TILE}"/>
    ${flower(size / 2, size / 2, size * 0.64)}
  </svg>`;
}

// 2) Icone arredondado (ficha da loja 512) — TILE com cantos + girassol.
function iconRounded(size) {
  const r = Math.round(size * 0.22);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${TILE}"/>
    ${flower(size / 2, size / 2, size * 0.6)}
  </svg>`;
}

// 3) Foreground adaptativo (transparente, girassol na zona segura ~62%).
function iconForeground(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${flower(size / 2, size / 2, size * 0.5)}
  </svg>`;
}

// 4) Feature graphic 1024x500: faixa esquerda (gradiente marca + ladrilho + girassol +
//    "Clinica Girassois"); direita (BG) com "Girassois+" + tagline.
function featureGraphic() {
  const W = 1024;
  const H = 500;
  const bandW = 420;
  const tileSize = 132;
  const tileX = bandW / 2 - tileSize / 2;
  const tileY = 150;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>${brandGradientDef("brand", 150)}</defs>
    <rect width="${W}" height="${H}" fill="${BG}"/>
    <rect width="${bandW}" height="${H}" fill="url(#brand)"/>
    <rect x="${tileX}" y="${tileY}" width="${tileSize}" height="${tileSize}" rx="30" fill="${TILE}"/>
    ${flower(bandW / 2, tileY + tileSize / 2, tileSize * 0.66)}
    <text x="${bandW / 2}" y="340" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#15203a">Clínica Girassóis</text>
    <text x="${bandW + 56}" y="226" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="800" fill="${"#f5a05a"}">Girassóis+</text>
    <text x="${bandW + 58}" y="276" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="500" fill="#cdd6e6">Cuidado e desenvolvimento em TEA</text>
    <text x="${bandW + 58}" y="316" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="400" fill="#8b97ad">Agenda · evoluções · devolutivas</text>
  </svg>`;
}

await render(iconRounded(512), resolve(ASSETS, "icon/icon-512.png"), 512, 512);
await render(iconSquare(1024), resolve(ASSETS, "icon/icon-1024.png"), 1024, 1024);
await render(iconForeground(1024), resolve(ASSETS, "icon/adaptive-foreground-1024.png"), 1024, 1024);
await render(featureGraphic(), resolve(ASSETS, "feature-graphic/feature-graphic.png"), 1024, 500);
console.log("done");
