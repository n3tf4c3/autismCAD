import assert from "node:assert/strict";
import { test } from "node:test";

import { evolucaoPayloadSchema } from "@autismcad/validators/prontuario/prontuario.schema";

// Achado 96: itens de desempenho nao podem ter contagens negativas nem
// acertos > tentativas. A validacao roda no schema compartilhado (web + mobile).

test("aceita item com acertos <= tentativas", () => {
  const result = evolucaoPayloadSchema.safeParse({
    itensDesempenho: [{ tentativas: 10, acertos: 7 }],
  });
  assert.equal(result.success, true);
});

test("rejeita tentativas negativas", () => {
  const result = evolucaoPayloadSchema.safeParse({
    itensDesempenho: [{ tentativas: -1 }],
  });
  assert.equal(result.success, false);
});

test("rejeita acertos negativos", () => {
  const result = evolucaoPayloadSchema.safeParse({
    itensDesempenho: [{ acertos: -3 }],
  });
  assert.equal(result.success, false);
});

test("rejeita acertos maior que tentativas", () => {
  const result = evolucaoPayloadSchema.safeParse({
    itensDesempenho: [{ tentativas: 5, acertos: 8 }],
  });
  assert.equal(result.success, false);
});

test("rejeita contagem nao inteira", () => {
  const result = evolucaoPayloadSchema.safeParse({
    itensDesempenho: [{ tentativas: 3.5 }],
  });
  assert.equal(result.success, false);
});

test("aceita strings numericas (form web) dentro da faixa", () => {
  const result = evolucaoPayloadSchema.safeParse({
    itens: [{ tentativas: "10", acertos: "4" }],
  });
  assert.equal(result.success, true);
});

test("rejeita string numerica com acertos > tentativas", () => {
  const result = evolucaoPayloadSchema.safeParse({
    itens: [{ tentativas: "2", acertos: "9" }],
  });
  assert.equal(result.success, false);
});
