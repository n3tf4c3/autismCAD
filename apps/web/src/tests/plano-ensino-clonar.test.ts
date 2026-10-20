import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { AppError, toAppError } from "@autismcad/shared/errors";

const { loadSource, queryResult } = createRequire(import.meta.url)("../../../../scripts/testing/load-source.cjs");
const pageEntry = "apps/web/src/app/(protected)/prontuario/[pacienteId]/plano-ensino/page.tsx";
const actionEntry = "apps/web/src/app/(protected)/prontuario/plano-ensino.actions.ts";
const formEntry = "@/app/(protected)/prontuario/[pacienteId]/plano-ensino/plano-ensino-form.client";
const env = { NODE_ENV: "test", APP_TIMEZONE: "America/Cuiaba" };

async function fixture(options: { deniedPermission?: string; deniedPatient?: number; missing?: boolean; tipo?: string; status?: string; destinoId?: number } = {}) {
  const calls: string[] = [];
  const access = { exists: true, permissions: new Set(["prontuario:create", "prontuario:view"]) };
  const original = {
    id: 7, pacienteId: 1, tipo: options.tipo ?? "PLANO_ENSINO", status: options.status ?? "Finalizado",
    payload: {
      especialidade: "Psicologia", responsavelTecnico: "Técnica sintética", data_inicio: "2026-10-01", data_final: "2026-12-31",
      itens: [{ habilidade: "Comunicação", objetivo_ensino: "Pedir ajuda", objetivo_especifico: "Solicitar apoio", criterio_sucesso: "4 de 5" }],
    },
  };
  const source = await loadSource(pageEntry, {
    "@/lib/env": { env },
    "@autismcad/shared/errors": { AppError, toAppError },
    "next/link": { default: () => null },
    [formEntry]: { PlanoEnsinoFormClient: () => null },
    "@/db": { db: { select: () => { calls.push("patient-query"); return queryResult([{ id: options.destinoId ?? 2, nome: "Paciente destino" }]); } } },
    "@/server/auth/auth": { requirePermission: async (key: string) => {
      calls.push(key);
      if (options.deniedPermission === key) throw new AppError("Negado", 403, "FORBIDDEN");
      return { user: { id: 3 }, access };
    } },
    "@/server/auth/paciente-access": { assertPacienteAccess: async (_user: unknown, id: number, loadedAccess: unknown) => {
      assert.equal(loadedAccess, access);
      calls.push(`patient:${id}`);
      if (options.deniedPatient === id) throw new AppError("Acesso negado ao paciente", 403, "FORBIDDEN");
    } },
    "@/server/modules/prontuario/prontuario.service": { obterDocumento: async (id: number) => {
      assert.equal(id, 7); calls.push("document"); return options.missing ? null : original;
    } },
  });
  return { source, calls, original };
}

for (const status of ["Rascunho", "Finalizado"]) {
  for (const pacienteId of ["1", "2"]) {
    test(`Clonagem de ${status} para paciente ${pacienteId} preenche novo formulário sem vincular a edição ao original`, async () => {
      const { source, calls, original } = await fixture({ status, destinoId: Number(pacienteId) });
      const snapshot = structuredClone(original);
      const result = await source.default({ params: Promise.resolve({ pacienteId }), searchParams: Promise.resolve({ clonarDe: "7" }) });
      const form = result.props.children.at(-1);
      assert.equal(form.props.pacienteId, Number(pacienteId));
      assert.equal(form.props.initialData.sourceDocumentId, null);
      assert.equal(form.props.canFinalize, false);
      assert.equal(form.props.initialData.especialidade, "Psicologia");
      assert.equal(form.props.initialData.responsavelTecnico, "Técnica sintética");
      assert.equal(form.props.initialData.dataInicio, "2026-10-01");
      assert.equal(form.props.initialData.dataFinal, "2026-12-31");
      assert.equal(form.props.initialData.blocos[0].objetivoEnsino, "Pedir ajuda");
      assert.equal(form.props.initialData.blocos[0].objetivoEspecifico, "Solicitar apoio");
      assert.equal(form.props.initialData.blocos[0].criterioSucesso, "4 de 5");
      assert.deepEqual(calls, ["prontuario:create", "prontuario:view", `patient:${pacienteId}`, "patient-query", "document", "patient:1"]);
      assert.deepEqual(original, snapshot);
    });
  }
}

for (const permission of ["prontuario:create", "prontuario:view"]) {
  test(`Clonagem exige ${permission} antes de ler o plano`, async () => {
    const { source, calls } = await fixture({ deniedPermission: permission });
    await assert.rejects(source.default({ params: Promise.resolve({ pacienteId: "2" }), searchParams: Promise.resolve({ clonarDe: "7" }) }), { code: "FORBIDDEN" });
    assert.ok(!calls.includes("document"));
  });
}

for (const deniedPatient of [1, 2]) {
  test(`Clonagem nega acesso ao paciente ${deniedPatient} e não envia payload ao formulário`, async () => {
    const { source, calls } = await fixture({ deniedPatient });
    const result = await source.default({ params: Promise.resolve({ pacienteId: "2" }), searchParams: Promise.resolve({ clonarDe: "7" }) });
    assert.match(JSON.stringify(result), /Acesso negado ao paciente/);
    assert.doesNotMatch(JSON.stringify(result), /Pedir ajuda|initialData/);
    if (deniedPatient === 2) assert.ok(!calls.includes("document"));
  });
}

test("Clonagem rejeita identificadores inválidos, ambiguidade, plano ausente e outros tipos", async () => {
  for (const searchParams of [{ clonarDe: "" }, { clonarDe: "abc" }, { clonarDe: "-1" }, { clonarDe: "1.5" }, { clonarDe: "7", documentoId: "7" }]) {
    const { source, calls } = await fixture();
    const result = await source.default({ params: Promise.resolve({ pacienteId: "2" }), searchParams: Promise.resolve(searchParams) });
    assert.match(JSON.stringify(result), /inválido/);
    assert.ok(!calls.includes("document"));
  }
  for (const options of [{ missing: true }, { tipo: "ANAMNESE" }]) {
    const { source } = await fixture(options);
    const result = await source.default({ params: Promise.resolve({ pacienteId: "2" }), searchParams: Promise.resolve({ clonarDe: "7" }) });
    assert.doesNotMatch(JSON.stringify(result), /initialData/);
  }
});

test("Edição continua restrita ao paciente do documento e bloqueada após finalização", async () => {
  const { source } = await fixture();
  for (const pacienteId of ["1", "2"]) {
    const result = await source.default({ params: Promise.resolve({ pacienteId }), searchParams: Promise.resolve({ documentoId: "7" }) });
    assert.doesNotMatch(JSON.stringify(result), /initialData/);
  }
});

test("Busca de destinos exige criar e visualizar, usa o escopo do usuário e retorna somente ID e nome", async () => {
  for (const deniedPermission of [undefined, "prontuario:create", "prontuario:view"]) {
    const calls: string[] = [];
    const action = await loadSource(actionEntry, {
      "@/lib/env": { env },
      "@autismcad/shared/errors": { AppError, toAppError },
      "@/server/auth/auth": { requirePermission: async (key: string) => {
        calls.push(key);
        if (key === deniedPermission) throw new AppError("Negado", 403, "FORBIDDEN");
        return { user: { id: 3 } };
      } },
      "@/server/modules/pacientes/pacientes.service": { listarPacientesPorUsuario: async (id: number, filters: object) => {
        calls.push("patients"); assert.equal(id, 3); assert.deepEqual(filters, { nome: "Destino" });
        return [{ id: 2, nome: "Destino", cpf: "privado", telefone: "privado" }];
      } },
    });
    const result = await action.buscarPacientesParaClonarPlanoAction("  Destino  ");
    assert.equal(result.ok, !deniedPermission);
    if (!deniedPermission) {
      assert.deepEqual(result.data, [{ id: 2, nome: "Destino" }]);
      assert.deepEqual(calls, ["prontuario:create", "prontuario:view", "patients"]);
      const invalid = await action.buscarPacientesParaClonarPlanoAction("a".repeat(121));
      assert.equal(invalid.ok, false);
      assert.equal(calls.filter((call) => call === "patients").length, 1);
    } else {
      assert.equal(result.code, "FORBIDDEN");
      assert.ok(!calls.includes("patients"));
    }
  }
});
