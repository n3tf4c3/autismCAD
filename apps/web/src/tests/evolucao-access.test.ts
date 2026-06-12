import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isEvolucaoAccessAllowed,
  resolveEvolucaoProfissionalId,
} from "@/lib/prontuario/evolucao-access";

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

// Achado 57: a atribuicao de uma nova evolucao usa o papel/profissional EFETIVO.

test("resolveEvolucaoProfissionalId usa profissionalId informado para papel nao-PROFISSIONAL", () => {
  assert.deepEqual(
    resolveEvolucaoProfissionalId({
      roleCanon: "ADMIN",
      ownProfissionalId: null,
      inputProfissionalId: 9,
    }),
    { profissionalId: 9, forbidden: false }
  );
});

test("resolveEvolucaoProfissionalId forca o proprio profissionalId quando PROFISSIONAL omite", () => {
  assert.deepEqual(
    resolveEvolucaoProfissionalId({
      roleCanon: "PROFISSIONAL",
      ownProfissionalId: 7,
      inputProfissionalId: null,
    }),
    { profissionalId: 7, forbidden: false }
  );
});

test("resolveEvolucaoProfissionalId bloqueia PROFISSIONAL atribuindo a outro profissional", () => {
  assert.deepEqual(
    resolveEvolucaoProfissionalId({
      roleCanon: "PROFISSIONAL",
      ownProfissionalId: 7,
      inputProfissionalId: 9,
    }),
    { profissionalId: null, forbidden: true }
  );
});

test("resolveEvolucaoProfissionalId bloqueia PROFISSIONAL sem vinculo", () => {
  assert.deepEqual(
    resolveEvolucaoProfissionalId({
      roleCanon: "PROFISSIONAL",
      ownProfissionalId: null,
      inputProfissionalId: 7,
    }),
    { profissionalId: null, forbidden: true }
  );
});
