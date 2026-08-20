import assert from "node:assert/strict";
import { test } from "node:test";

import { derivarTurno } from "@autismcad/validators/atendimentos/atendimentos.schema";
import { isForeignKeyViolation } from "@autismcad/shared/pg-errors";

// Turno deixou de ser escolha livre: o servidor deriva do horario de inicio para
// nao gravar combinacoes como "Vespertino as 08:00", que sujam relatorio e o
// casamento por turno do excluirDia.
test("derivarTurno usa o corte das 12h", () => {
  assert.equal(derivarTurno("00:00"), "Matutino");
  assert.equal(derivarTurno("08:00"), "Matutino");
  assert.equal(derivarTurno("11:59"), "Matutino");
  assert.equal(derivarTurno("12:00"), "Vespertino");
  assert.equal(derivarTurno("17:00"), "Vespertino");
  assert.equal(derivarTurno("23:59"), "Vespertino");
});

test("derivarTurno aceita HH:MM:SS e cai em Matutino no lixo", () => {
  assert.equal(derivarTurno("14:00:00"), "Vespertino");
  assert.equal(derivarTurno("09:30:00"), "Matutino");
  assert.equal(derivarTurno(""), "Matutino");
  assert.equal(derivarTurno("nao e hora"), "Matutino");
});

// A troca de profissional de um atendimento ja evoluido bate na FK composta
// evolucoes -> atendimentos (ON UPDATE NO ACTION) e chegava como "Erro interno".
test("isForeignKeyViolation reconhece 23503 e filtra pela constraint", () => {
  const erro = {
    code: "23503",
    constraint: "evolucoes_atendimento_composto_fk",
    message: 'update or delete on table "atendimentos" violates foreign key constraint',
  };
  assert.equal(isForeignKeyViolation(erro), true);
  assert.equal(isForeignKeyViolation(erro, "evolucoes_atendimento_composto_fk"), true);
  assert.equal(isForeignKeyViolation(erro, "outra_constraint"), false);
});

test("isForeignKeyViolation percorre a cadeia de causes e ignora outros erros", () => {
  const encadeado = new Error("falha ao salvar") as Error & { cause?: unknown };
  encadeado.cause = { code: "23503", constraint: "evolucoes_atendimento_composto_fk" };
  assert.equal(isForeignKeyViolation(encadeado, "evolucoes_atendimento_composto_fk"), true);

  assert.equal(isForeignKeyViolation({ code: "23505" }), false);
  assert.equal(isForeignKeyViolation(new Error("timeout")), false);
  assert.equal(isForeignKeyViolation(null), false);
});
