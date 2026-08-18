import assert from "node:assert/strict";
import { test } from "node:test";

import { buildEngajamentoResumo } from "@/lib/relatorios/engajamento";

// O engajamento das metas da evolucao so admite Sim / Nao. Registros anteriores ao
// rename do campo guardam o antigo "Alvo" (texto livre) no mesmo `opcao`: nao entram
// na contagem, so no aviso de ignorados.

function evolucao(opcoes: Array<string | undefined>) {
  return {
    data: "2026-08-01",
    payload: { itensDesempenho: opcoes.map((opcao) => ({ opcao })) },
  };
}

test("sem evolucoes o total e zero", () => {
  const resumo = buildEngajamentoResumo(null);
  assert.equal(resumo.total, 0);
  assert.equal(resumo.ignorados, 0);
});

test("conta sim e nao com acento, caixa e abreviacao", () => {
  const resumo = buildEngajamentoResumo([
    evolucao(["Sim", "sim", "S"]),
    evolucao(["Não", "nao", "N"]),
  ]);

  assert.equal(resumo.total, 6);
  assert.equal(resumo.ignorados, 0);
  assert.deepEqual(
    resumo.rows.map((row) => [row.key, row.value, row.pct]),
    [
      ["sim", 3, 50],
      ["nao", 3, 50],
    ],
  );
});

test("valores fora do padrao nao entram no grafico, so em ignorados", () => {
  const resumo = buildEngajamentoResumo([evolucao(["Sim", "Vogais", "Quebra cabeça"])]);

  assert.equal(resumo.total, 1);
  assert.equal(resumo.ignorados, 2);
  assert.deepEqual(
    resumo.rows.map((row) => [row.key, row.value, row.pct]),
    [
      ["sim", 1, 100],
      ["nao", 0, 0],
    ],
  );
});

test("periodo so com dado antigo fica sem grafico", () => {
  const resumo = buildEngajamentoResumo([evolucao(["Vogais", "Animais", "bola"])]);
  assert.equal(resumo.total, 0);
  assert.equal(resumo.ignorados, 3);
});

test("itens sem engajamento preenchido nao contam nem como ignorados", () => {
  const resumo = buildEngajamentoResumo([evolucao(["Sim", "", undefined, "   "])]);
  assert.equal(resumo.total, 1);
  assert.equal(resumo.ignorados, 0);
});

test("aceita payload antigo com `itens` no lugar de `itensDesempenho`", () => {
  const resumo = buildEngajamentoResumo([
    { data: "2026-08-01", payload: { itens: [{ opcao: "Sim" }, { opcao: "Nao" }] } },
  ]);
  assert.equal(resumo.total, 2);
});
