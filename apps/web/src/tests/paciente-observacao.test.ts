import assert from "node:assert/strict";
import { test } from "node:test";

import { savePacienteSchema } from "@autismcad/validators/pacientes/pacientes.schema";

const pacienteBase = {
  nome: "Paciente Teste",
  cpf: "12345678901",
  dataNascimento: "2020-01-10",
  convenio: "Particular",
  email: null,
  nomeResponsavel: "Responsável Teste",
  telefone: "65999999999",
  telefone2: null,
  nomeMae: null,
  nomePai: null,
  sexo: "Outro",
  dataInicio: "2026-08-25",
  fotoAtual: null,
  laudoAtual: null,
  documentoAtual: null,
  ativo: true,
  terapias: [],
};

test("cadastro de paciente aceita observacao opcional e remove espacos externos", () => {
  const parsed = savePacienteSchema.parse({
    ...pacienteBase,
    observacao: "  Informação importante para a equipe.  ",
  });

  assert.equal(parsed.observacao, "Informação importante para a equipe.");
  assert.equal(savePacienteSchema.safeParse(pacienteBase).success, true);
});

test("cadastro de paciente limita observacao a 4000 caracteres", () => {
  assert.equal(
    savePacienteSchema.safeParse({ ...pacienteBase, observacao: "a".repeat(4000) }).success,
    true
  );
  assert.equal(
    savePacienteSchema.safeParse({ ...pacienteBase, observacao: "a".repeat(4001) }).success,
    false
  );
});
