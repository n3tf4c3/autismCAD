import assert from "node:assert/strict";
import { test } from "node:test";

import {
  consolidarPendenciasDevolutiva,
  type AtendimentoControleDevolutiva,
} from "@/server/modules/relatorios/devolutivas-pendentes";

function atendimento(
  overrides: Partial<AtendimentoControleDevolutiva>
): AtendimentoControleDevolutiva {
  return {
    id: 1,
    paciente_id: 10,
    paciente_nome: "Paciente A",
    data: "2026-08-24",
    hora_inicio: "08:00:00",
    hora_fim: "09:00:00",
    presenca: "Presente",
    profissional_id: 20,
    profissional_nome: "Terapeuta B",
    evolucao_id: null,
    ...overrides,
  };
}

test("controle inclui somente presenca confirmada sem evolucao ativa", () => {
  const result = consolidarPendenciasDevolutiva([
    atendimento({ id: 1 }),
    atendimento({ id: 2, presenca: "Ausente" }),
    atendimento({ id: 3, evolucao_id: 30 }),
    atendimento({ id: 4, presenca: "Nao informado" }),
  ]);

  assert.deepEqual(result.map((item) => item.atendimentoId), [1]);
});

test("controle ordena por profissional e prioriza registros antigos", () => {
  const result = consolidarPendenciasDevolutiva([
    atendimento({ id: 1, profissional_nome: "Terapeuta B", data: "2026-08-24" }),
    atendimento({ id: 2, profissional_nome: "Terapeuta A", data: "2026-08-23" }),
    atendimento({ id: 3, profissional_nome: "Terapeuta A", data: "2026-08-20" }),
  ]);

  assert.deepEqual(result.map((item) => item.atendimentoId), [3, 2, 1]);
  assert.equal(result[0]?.horaInicio, "08:00");
  assert.equal(result[0]?.horaFim, "09:00");
});
