import assert from "node:assert/strict";
import { test } from "node:test";

import { isEvolucaoAccessAllowed } from "@/lib/prontuario/evolucao-access";

// Achado 51: a restricao "profissional so acessa a propria evolucao" deve valer
// quando o papel EFETIVO e PROFISSIONAL. Combinado com resolveEffectiveRoleCanon,
// isso fecha a janela em que o JWT defasado deixava passar role antiga.

test("papel nao-PROFISSIONAL passa direto", () => {
  assert.equal(
    isEvolucaoAccessAllowed({
      roleCanon: "ADMIN",
      accessProfissionalId: null,
      evolucaoProfissionalId: 5,
    }),
    true
  );
});

test("PROFISSIONAL acessa evolucao do proprio profissionalId", () => {
  assert.equal(
    isEvolucaoAccessAllowed({
      roleCanon: "PROFISSIONAL",
      accessProfissionalId: 7,
      evolucaoProfissionalId: 7,
    }),
    true
  );
});

test("PROFISSIONAL e bloqueado em evolucao de outro profissional", () => {
  assert.equal(
    isEvolucaoAccessAllowed({
      roleCanon: "PROFISSIONAL",
      accessProfissionalId: 7,
      evolucaoProfissionalId: 9,
    }),
    false
  );
});

test("PROFISSIONAL sem profissionalId vinculado e bloqueado", () => {
  assert.equal(
    isEvolucaoAccessAllowed({
      roleCanon: "PROFISSIONAL",
      accessProfissionalId: null,
      evolucaoProfissionalId: 9,
    }),
    false
  );
});
