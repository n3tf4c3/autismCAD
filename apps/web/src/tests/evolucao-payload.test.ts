import assert from "node:assert/strict";
import { test } from "node:test";

import {
  criarEvolucaoSchema,
  evolucaoPayloadSchema,
  isEvolucaoPayloadUpdateAllowed,
} from "@autismcad/validators/prontuario/prontuario.schema";

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

test("nova evolucao exige payload v2 e engajamento sim ou nao", () => {
  const defaulted = criarEvolucaoSchema.safeParse({});
  assert.equal(defaulted.success, true);
  if (defaulted.success) assert.equal(defaulted.data.payload.schemaVersion, 2);

  assert.equal(
    criarEvolucaoSchema.safeParse({
      payload: { schemaVersion: 2, itensDesempenho: [{ opcao: "sim" }] },
    }).success,
    true
  );
  assert.equal(
    criarEvolucaoSchema.safeParse({
      payload: { schemaVersion: 2, itensDesempenho: [{ opcao: "talvez" }] },
    }).success,
    false
  );
  assert.equal(
    criarEvolucaoSchema.safeParse({
      payload: { itensDesempenho: [{ opcao: "talvez" }] },
    }).success,
    false
  );
});

test("payload v2 rejeita alias legado e chave arbitraria no item", () => {
  const legacyAlias = criarEvolucaoSchema.safeParse({
    payload: { schemaVersion: 2, itens: [{ opcao: "talvez" }] },
  });
  const extraItemKey = criarEvolucaoSchema.safeParse({
    payload: {
      schemaVersion: 2,
      itensDesempenho: [{ opcao: "sim", campoArbitrario: "x" }],
    },
  });
  assert.equal(legacyAlias.success, false);
  assert.equal(extraItemKey.success, false);
});

test("update legado pode preservar texto antigo sem criar outro", () => {
  const current = { itensDesempenho: [{ opcao: "Vogais" }, { opcao: "sim" }] };
  assert.equal(
    isEvolucaoPayloadUpdateAllowed(current, {
      itensDesempenho: [{ opcao: "Vogais" }, { opcao: "nao" }],
    }),
    true
  );
  assert.equal(
    isEvolucaoPayloadUpdateAllowed(current, {
      itensDesempenho: [{ opcao: "Vogais" }, { opcao: "Novo texto livre" }],
    }),
    false
  );

  const currentAlias = { itens: [{ opcao: "Vogais" }] };
  assert.equal(
    isEvolucaoPayloadUpdateAllowed(currentAlias, {
      itensDesempenho: [{ opcao: "Vogais" }],
    }),
    true
  );
  assert.equal(
    isEvolucaoPayloadUpdateAllowed(currentAlias, {
      itensDesempenho: [{ opcao: "Vogais" }],
      itens: [{ opcao: "Texto injetado" }],
    }),
    false
  );
});

test("payload v2 nao pode sofrer downgrade para texto livre", () => {
  const current = { schemaVersion: 2, itensDesempenho: [{ opcao: "sim" }] };
  assert.equal(
    isEvolucaoPayloadUpdateAllowed(current, {
      itensDesempenho: [{ opcao: "texto livre" }],
    }),
    false
  );
});
