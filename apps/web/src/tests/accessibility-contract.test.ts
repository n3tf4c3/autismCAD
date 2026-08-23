import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const SRC_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

function source(relativePath: string): string {
  return readFileSync(join(SRC_DIR, relativePath), "utf8");
}

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.isFile() && path.endsWith(".tsx") ? [path] : [];
  });
}

function relativeLuminance(hex: string): number {
  const channels = hex
    .replace("#", "")
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);
  assert.ok(channels && channels.length === 3, `Cor invalida: ${hex}`);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string): number {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (light + 0.05) / (dark + 0.05);
}

test("texto de acao atende contraste AA em todos os fundos claros de marca", () => {
  const foreground = "#333333";
  const backgrounds = ["#f7a928", "#ffb94d", "#e6961f", "#ffcc66", "#ffd966", "#7fb3ff", "#6dd3c7"];

  for (const background of backgrounds) {
    assert.ok(
      contrast(foreground, background) >= 4.5,
      `${foreground} sobre ${background} deveria atingir 4.5:1`
    );
  }
});

test("acoes laranja e gradientes de marca nao usam mais texto branco", () => {
  const violations = tsxFiles(SRC_DIR).flatMap((path) =>
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line, index) => ({ line, location: `${path}:${index + 1}` }))
      .filter(({ line }) =>
        (line.includes("var(--laranja)") || line.includes("from-[#FFD966]")) && line.includes("text-white")
      )
      .map(({ location }) => location)
  );

  assert.deepEqual(violations, []);
  assert.match(source("app/globals.css"), /--texto-sobre-acao:\s*#333333/);
});

test("dialog compartilhado preserva nome, foco, Tab, Escape e retorno", () => {
  const dialog = source("components/ui/accessible-dialog.tsx");

  assert.match(dialog, /aria-labelledby=\{titleId\}/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /event\.key === "Escape"/);
  assert.match(dialog, /event\.key !== "Tab"/);
  assert.match(dialog, /initialFocus\.focus\(\)/);
  assert.match(dialog, /previousFocus\.focus\(\)/);

  for (const page of [
    "app/(protected)/consultas/consultas.client.tsx",
    "app/(protected)/pacientes/pacientes-page.client.tsx",
  ]) {
    assert.match(source(page), /<AccessibleDialog/);
  }
});

test("campos de evolucao associam rotulos estaticos e dinamicos", () => {
  const form = source("app/(protected)/prontuario/[pacienteId]/evolucao/evolucao-form.client.tsx");

  for (const id of ["evolucao-data", "evolucao-atendimento", "evolucao-titulo", "evolucao-conduta", "evolucao-descricao"]) {
    assert.match(form, new RegExp(`htmlFor="${id}"`));
    assert.match(form, new RegExp(`id="${id}"`));
  }
  for (const suffix of ["objetivo", "habilidade", "engajamento", "desempenho", "ajuda", "tentativas", "acertos", "reforcador"]) {
    assert.ok(form.includes(`htmlFor={\`meta-\${row.id}-${suffix}\`}`));
    assert.ok(form.includes(`id={\`meta-\${row.id}-${suffix}\`}`));
  }
});
