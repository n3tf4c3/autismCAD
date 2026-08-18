import assert from "node:assert/strict";
import { test } from "node:test";

import { buildEngajamentoResumo } from "@/lib/relatorios/engajamento";

// O engajamento e texto livre (campo `opcao` das metas da evolucao). O resumo
// classifica em Sim / Nao / Outros para alimentar o grafico de pizza.

function evolucao(opcoes: Array<string | undefined>) {
  return {
    data: "2026-08-01",
    payload: { itensDesempenho: opcoes.map((opcao) => ({ opcao })) },
  };
}

test("sem evolucoes o total e zero", () => {
  const resumo = buildEngajamentoResumo(null);
  assert.equal(resumo.total, 0);
  assert.deepEqual(resumo.rowsOutros, []);
});

test("conta sim e nao com acento, caixa e abreviacao", () => {
  const resumo = buildEngajamentoResumo([
    evolucao(["Sim", "sim", "S"]),
    evolucao(["Não", "nao", "N", " NAO "]),
  ]);

  assert.equal(resumo.total, 7);
  assert.deepEqual(
    resumo.rows.map((row) => [row.key, row.value, row.pct]),
    [
      ["sim", 3, 43],
      ["nao", 4, 57],
    ],
  );
});

test("valores fora do padrao caem em Outros e sao listados", () => {
  const resumo = buildEngajamentoResumo([evolucao(["Sim", "Parcial", "parcial", "As vezes"])]);

  const outros = resumo.rows.find((row) => row.key === "outros");
  assert.equal(outros?.value, 3);
  assert.deepEqual(
    resumo.rowsOutros.map((row) => [row.label, row.value]),
    [
      ["Parcial", 2],
      ["As vezes", 1],
    ],
  );
});

test("ignora itens sem engajamento preenchido", () => {
  const resumo = buildEngajamentoResumo([evolucao(["Sim", "", undefined, "   "])]);
  assert.equal(resumo.total, 1);
  assert.equal(resumo.rows.length, 2);
});

test("aceita payload antigo com `itens` no lugar de `itensDesempenho`", () => {
  const resumo = buildEngajamentoResumo([
    { data: "2026-08-01", payload: { itens: [{ opcao: "Sim" }, { opcao: "Nao" }] } },
  ]);
  assert.equal(resumo.total, 2);
});
