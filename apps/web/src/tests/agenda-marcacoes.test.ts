import assert from "node:assert/strict";
import { test } from "node:test";

import { criarBloqueiosSchema } from "@autismcad/validators/agenda/bloqueios.schema";

const base = {
  profissionalId: 1,
  datas: ["2026-08-25"],
  horaInicio: "08:00",
  horaFim: "09:00",
};

test("marcacao de agenda aceita horario LIVRE", () => {
  const parsed = criarBloqueiosSchema.parse({ ...base, tipo: "LIVRE" });
  assert.equal(parsed.tipo, "LIVRE");
});

test("marcacao antiga continua sendo bloqueio por padrao", () => {
  const parsed = criarBloqueiosSchema.parse(base);
  assert.equal(parsed.tipo, "BLOQUEADO");
});

test("marcacao de agenda rejeita tipo desconhecido", () => {
  assert.equal(criarBloqueiosSchema.safeParse({ ...base, tipo: "OCUPADO" }).success, false);
});
