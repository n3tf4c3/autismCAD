import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { buildConsultasActions, type ConsultasActionsDeps } from "@/app/(protected)/consultas/consultas.actions.impl";

class AppError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

type SessionUser = { id: number; role?: string | null };

const calls = {
  requirePermission: [] as Array<string | string[]>,
  assertPacienteAccess: [] as Array<{ user: SessionUser; pacienteId: number }>,
  listarAtendimentosPorUsuario: [] as Array<{ userId: number; filters: unknown }>,
  salvarAtendimento: [] as Array<{ input: unknown; id: number | null }>,
  criarRecorrentes: [] as Array<{ input: unknown }>,
  excluirDia: [] as Array<{ input: unknown; deletedByUserId?: number | null }>,
};

const state = {
  requirePermissionError: null as unknown,
  requirePermissionUser: { id: 101, role: "profissional" } as SessionUser,
  assertPacienteAccessError: null as unknown,
  listarAtendimentosPorUsuarioResult: [] as unknown[],
  salvarAtendimentoResult: 999,
  criarRecorrentesResult: {
    criados: 1,
    atendimentos: [{ id: 777, data: "2026-04-06" }],
  },
  excluirDiaResult: { removidos: 3 },
};

function resetState() {
  calls.requirePermission.length = 0;
  calls.assertPacienteAccess.length = 0;
  calls.listarAtendimentosPorUsuario.length = 0;
  calls.salvarAtendimento.length = 0;
  calls.criarRecorrentes.length = 0;
  calls.excluirDia.length = 0;

  state.requirePermissionError = null;
  state.requirePermissionUser = { id: 101, role: "profissional" };
  state.assertPacienteAccessError = null;
  state.listarAtendimentosPorUsuarioResult = [];
  state.salvarAtendimentoResult = 999;
  state.criarRecorrentesResult = {
    criados: 1,
    atendimentos: [{ id: 777, data: "2026-04-06" }],
  };
  state.excluirDiaResult = { removidos: 3 };
}

const deps: ConsultasActionsDeps = {
  requirePermission: async (permission) => {
    calls.requirePermission.push(permission);
    if (state.requirePermissionError) throw state.requirePermissionError;
    return { user: state.requirePermissionUser, access: {} };
  },
  assertPacienteAccess: async (user, pacienteId) => {
    calls.assertPacienteAccess.push({ user: user as SessionUser, pacienteId });
    if (state.assertPacienteAccessError) throw state.assertPacienteAccessError;
    return { userId: Number(user.id), access: {}, profissionalId: null };
  },
  atendimentosQuerySchema: { parse: (input) => input },
  excluirDiaSchema: { parse: (input) => input as { pacienteId: number } },
  recorrenteSchema: { parse: (input) => input as { pacienteId: number } },
  saveAtendimentoSchema: { parse: (input) => input as { pacienteId: number } },
  listarAtendimentosPorUsuario: async (userId, filters) => {
    calls.listarAtendimentosPorUsuario.push({ userId, filters });
    return state.listarAtendimentosPorUsuarioResult;
  },
  salvarAtendimento: async (input, id) => {
    calls.salvarAtendimento.push({ input, id: id ?? null });
    return state.salvarAtendimentoResult;
  },
  criarRecorrentes: async (input) => {
    calls.criarRecorrentes.push({ input });
    return state.criarRecorrentesResult;
  },
  excluirDia: async (input, deletedByUserId) => {
    calls.excluirDia.push({ input, deletedByUserId });
    return state.excluirDiaResult;
  },
  softDeleteAtendimento: async () => ({ id: 1 }),
  AppError,
  toAppError: (error) => {
    if (error instanceof AppError) return error;
    if (error instanceof Error) return new AppError(error.message, 500, "INTERNAL_ERROR");
    return new AppError("Erro interno", 500, "INTERNAL_ERROR");
  },
};

const actions = buildConsultasActions(deps);

beforeEach(() => {
  resetState();
});

test("listarAtendimentosAction aplica escopo por usuario autenticado", async () => {
  state.requirePermissionUser = { id: 42, role: "profissional" };
  state.listarAtendimentosPorUsuarioResult = [{ id: 1 }, { id: 2 }];

  const result = await actions.listarAtendimentosAction({
    dataIni: "2026-04-01",
    dataFim: "2026-04-30",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.data.items, [{ id: 1 }, { id: 2 }]);
  }
  assert.deepEqual(calls.requirePermission, ["consultas:view"]);
  assert.equal(calls.listarAtendimentosPorUsuario.length, 1);
  assert.deepEqual(calls.listarAtendimentosPorUsuario[0], {
    userId: 42,
    filters: { dataIni: "2026-04-01", dataFim: "2026-04-30" },
  });
});

test("salvarAtendimentoAction valida acesso do paciente antes de salvar", async () => {
  const payload = {
    pacienteId: 17,
    profissionalId: 5,
    data: "2026-04-06",
    horaInicio: "08:00",
    horaFim: "09:00",
    isGrupo: false,
    turno: "Matutino",
    periodoInicio: null,
    periodoFim: null,
    presenca: "Nao informado",
    motivo: null,
    observacoes: null,
  };

  const result = await actions.salvarAtendimentoAction(33, payload);

  assert.equal(result.ok, true);
  assert.deepEqual(calls.requirePermission, [["consultas:edit", "consultas:presence"]]);
  assert.equal(calls.assertPacienteAccess.length, 1);
  assert.deepEqual(calls.assertPacienteAccess[0], {
    user: { id: 101, role: "profissional" },
    pacienteId: 17,
  });
  assert.equal(calls.salvarAtendimento.length, 1);
  assert.deepEqual(calls.salvarAtendimento[0], { input: payload, id: 33 });
});

test("salvarAtendimentoAction bloqueia persistencia quando acesso ao paciente e negado", async () => {
  state.assertPacienteAccessError = new AppError("Acesso negado ao paciente", 403, "FORBIDDEN");

  const result = await actions.salvarAtendimentoAction(33, {
    pacienteId: 17,
    profissionalId: 5,
    data: "2026-04-06",
    horaInicio: "08:00",
    horaFim: "09:00",
    presenca: "Nao informado",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "FORBIDDEN");
    assert.equal(result.status, 403);
  }
  assert.equal(calls.assertPacienteAccess.length, 1);
  assert.equal(calls.salvarAtendimento.length, 0);
});

test("criarAtendimentosRecorrentesAction valida acesso do paciente", async () => {
  const payload = {
    pacienteId: 17,
    profissionalId: 5,
    horaInicio: "08:00",
    horaFim: "09:00",
    isGrupo: false,
    turno: "Matutino",
    periodoInicio: "2026-04-01",
    periodoFim: "2026-04-30",
    presenca: "Nao informado",
    motivo: null,
    observacoes: null,
    diasSemana: [1, 3, 5],
  };

  const result = await actions.criarAtendimentosRecorrentesAction(payload);

  assert.equal(result.ok, true);
  assert.deepEqual(calls.requirePermission, ["consultas:create"]);
  assert.equal(calls.assertPacienteAccess.length, 1);
  assert.equal(calls.assertPacienteAccess[0]?.pacienteId, 17);
  assert.equal(calls.criarRecorrentes.length, 1);
});

test("excluirDiaAtendimentosAction valida acesso do paciente antes de excluir", async () => {
  state.requirePermissionUser = { id: 555, role: "profissional" };
  const payload = {
    pacienteId: 17,
    profissionalId: 5,
    horaInicio: "08:00",
    horaFim: "09:00",
    turno: "Matutino",
    periodoInicio: "2026-04-01",
    periodoFim: "2026-04-30",
    diaSemana: 1,
  };

  const result = await actions.excluirDiaAtendimentosAction(payload);

  assert.equal(result.ok, true);
  assert.deepEqual(calls.requirePermission, ["consultas:cancel"]);
  assert.equal(calls.assertPacienteAccess.length, 1);
  assert.deepEqual(calls.assertPacienteAccess[0], {
    user: { id: 555, role: "profissional" },
    pacienteId: 17,
  });
  assert.equal(calls.excluirDia.length, 1);
  assert.deepEqual(calls.excluirDia[0], {
    input: payload,
    deletedByUserId: 555,
  });
});
