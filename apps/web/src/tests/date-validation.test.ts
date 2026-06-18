import assert from "node:assert/strict";
import { test } from "node:test";

import {
  normalizeDateOnlyLoose,
  normalizeDateOnlyStrict,
} from "@autismcad/shared/normalize";
import { atendimentosQuerySchema } from "@autismcad/validators/atendimentos/atendimentos.schema";
import { evolutivoQuerySchema } from "@autismcad/validators/relatorios/relatorios.schema";
import { criarEvolucaoSchema } from "@autismcad/validators/prontuario/prontuario.schema";
import { saveProfissionalSchema } from "@autismcad/validators/profissionais/profissionais.schema";

// Achado 109/110: datas YYYY-MM-DD inexistentes (ex.: 2026-02-31) devem ser rejeitadas
// em normalizadores e schemas, em vez de passarem como string livre.

test("normalizeDateOnlyStrict exige data de calendario real", () => {
  assert.equal(normalizeDateOnlyStrict("2026-02-31"), null);
  assert.equal(normalizeDateOnlyStrict("2026-06-17"), "2026-06-17");
  assert.equal(normalizeDateOnlyStrict(""), null);
});

test("normalizeDateOnlyLoose nao rola data-only invalida para o mes seguinte", () => {
  assert.equal(normalizeDateOnlyLoose("2026-02-31", "America/Sao_Paulo"), null);
  assert.equal(normalizeDateOnlyLoose("2026-06-17", "America/Sao_Paulo"), "2026-06-17");
});

test("atendimentosQuerySchema valida dataIni: rejeita invalida, aceita valida/vazia/ausente", () => {
  assert.equal(atendimentosQuerySchema.safeParse({ dataIni: "2026-02-31" }).success, false);
  assert.equal(atendimentosQuerySchema.safeParse({ dataIni: "2026-06-17" }).success, true);
  assert.equal(atendimentosQuerySchema.safeParse({ dataIni: "" }).success, true);
  assert.equal(atendimentosQuerySchema.safeParse({}).success, true);
});

test("evolutivoQuerySchema rejeita 'from' com data inexistente", () => {
  assert.equal(
    evolutivoQuerySchema.safeParse({ pacienteId: 1, from: "2026-02-31" }).success,
    false
  );
  assert.equal(
    evolutivoQuerySchema.safeParse({ pacienteId: 1, from: "2026-06-17" }).success,
    true
  );
});

test("criarEvolucaoSchema rejeita data inexistente e aceita ausente", () => {
  assert.equal(criarEvolucaoSchema.safeParse({ data: "2026-02-31" }).success, false);
  assert.equal(criarEvolucaoSchema.safeParse({ data: "2026-06-17" }).success, true);
  assert.equal(criarEvolucaoSchema.safeParse({}).success, true);
});

// Achado 124: data de nascimento de profissional e opcional, mas quando informada deve
// ser data de calendario real — antes string invalida era descartada silenciosamente.
test("saveProfissionalSchema valida dataNascimento opcional", () => {
  const base = { nome: "Fulano", cpf: "12345678901", especialidade: "Fonoaudiologo" };
  assert.equal(
    saveProfissionalSchema.safeParse({ ...base, dataNascimento: "2026-02-31" }).success,
    false
  );
  const valido = saveProfissionalSchema.safeParse({ ...base, dataNascimento: "1990-05-20" });
  assert.equal(valido.success, true);
  assert.equal(valido.success && valido.data.dataNascimento, "1990-05-20");
  // ausente e vazia continuam aceitas (campo opcional), normalizadas para null
  assert.equal(saveProfissionalSchema.safeParse(base).success, true);
  const vazio = saveProfissionalSchema.safeParse({ ...base, dataNascimento: "" });
  assert.equal(vazio.success && vazio.data.dataNascimento, null);
});
