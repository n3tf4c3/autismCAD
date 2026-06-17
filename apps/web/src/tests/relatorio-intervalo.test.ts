import assert from "node:assert/strict";
import { test } from "node:test";

import {
  RELATORIO_MAX_INTERVALO_DIAS,
  excedeIntervaloMaximoDias,
} from "@/server/modules/relatorios/intervalo";

// Achado 108: relatorios so podem cobrir um intervalo limitado (evita carregar todos
// os registros de anos). O predicado decide quando o periodo excede o maximo.

test("intervalo dentro do limite nao excede", () => {
  assert.equal(excedeIntervaloMaximoDias("2026-01-01", "2026-01-31"), false);
  assert.equal(excedeIntervaloMaximoDias("2026-06-17", "2026-06-17"), false);
});

test("intervalo no limite exato nao excede", () => {
  // 366 dias inclusivos: 2024-01-01..2024-12-31 (ano bissexto)
  assert.equal(excedeIntervaloMaximoDias("2024-01-01", "2024-12-31", 366), false);
});

test("intervalo acima do limite excede", () => {
  assert.equal(excedeIntervaloMaximoDias("2020-01-01", "2026-01-01"), true);
  assert.equal(excedeIntervaloMaximoDias("2026-01-01", "2026-12-31", 30), true);
});

test("datas invalidas nao bloqueiam (validacao fica nos schemas)", () => {
  assert.equal(excedeIntervaloMaximoDias("xpto", "2026-01-01"), false);
});

test("constante de maximo e exportada", () => {
  assert.equal(typeof RELATORIO_MAX_INTERVALO_DIAS, "number");
});
