import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { AppError } from "@autismcad/shared/errors";

const { loadSource, queryResult } = createRequire(import.meta.url)("../../../../scripts/testing/load-source.cjs");
const entry = "apps/web/src/app/impressao/plano-ensino/individual/page.tsx";
const client = "./plano-ensino-documento-impressao.client";

async function fixture(options: { denyPermission?: boolean; denyPatient?: boolean; empty?: boolean } = {}) {
  const calls: string[] = [];
  const access = { exists: true };
  const source = await loadSource(entry, {
    "@/lib/env": { env: { APP_TIMEZONE: "America/Cuiaba" } },
    [client]: { PlanoEnsinoDocumentoImpressaoClient: () => null },
    "@/server/auth/auth": { requirePermission: async (key: string) => {
      calls.push(key);
      if (options.denyPermission) throw new AppError("Negado", 403, "FORBIDDEN");
      return { user: { id: 2 }, access };
    } },
    "@/server/auth/paciente-access": { assertPacienteAccess: async (_user: unknown, id: number, loadedAccess: unknown) => {
      assert.equal(id, 1);
      assert.equal(loadedAccess, access);
      calls.push("patient");
      if (options.denyPatient) throw new AppError("Acesso negado ao paciente", 403, "FORBIDDEN");
    } },
    "@/db": { db: { select: () => {
      calls.push("patient-query");
      return queryResult([{ id: 1, nome: "Paciente sintético", dataNascimento: "2020-01-15" }]);
    } } },
    "@/server/modules/prontuario/prontuario.service": { listarDocumentos: async (id: number, tipo: string) => {
      calls.push("documents");
      assert.equal(id, 1);
      assert.equal(tipo, "PLANO_ENSINO");
      return options.empty ? [] : [7, 6].map((id) => ({
        id, pacienteId: 1, titulo: `Plano ${id}`, status: id === 7 ? "Rascunho" : "Finalizado",
        autorNome: "Profissional sintético", updatedAt: new Date("2026-10-06T02:00:00Z"),
        payload: { especialidade: "Psicologia", data_inicio: "2026-10-01", itens: [{ habilidade: "Comunicação", objetivo_ensino: "Pedir ajuda" }] },
      }));
    } },
  });
  return { source, calls };
}

test("Impressão individual exige prontuario:view antes de carregar dados", async () => {
  const { source, calls } = await fixture({ denyPermission: true });
  await assert.rejects(source.default({ searchParams: Promise.resolve({ pacienteId: "1" }) }), { code: "FORBIDDEN" });
  assert.deepEqual(calls, ["prontuario:view"]);
});

test("Impressão individual nega paciente sem vínculo antes de carregar os planos", async () => {
  const { source, calls } = await fixture({ denyPatient: true });
  const result = await source.default({ searchParams: Promise.resolve({ pacienteId: "1", documentoId: "7" }) });
  assert.equal(result.props.mensagem, "Acesso negado ao paciente");
  assert.deepEqual(calls, ["prontuario:view", "patient"]);
});

test("Impressão individual rejeita identificadores inválidos sem consultar dados", async () => {
  for (const params of [
    { pacienteId: "0" }, { pacienteId: "1.5" }, { pacienteId: "abc" },
    { pacienteId: "1", documentoId: "" }, { pacienteId: "1", documentoId: "-2" },
    { pacienteId: "1", documentoId: "Infinity" },
  ]) {
    const { source, calls } = await fixture();
    const result = await source.default({ searchParams: Promise.resolve(params) });
    assert.match(result.props.mensagem, /inválido/);
    assert.deepEqual(calls, ["prontuario:view"]);
  }
});

test("Impressão individual não substitui um plano ausente ou de outro paciente", async () => {
  const { source } = await fixture();
  const result = await source.default({ searchParams: Promise.resolve({ pacienteId: "1", documentoId: "99" }) });
  assert.equal(result.props.mensagem, "Plano de ensino não encontrado para este paciente.");
});

test("Impressão individual abre o último salvo ou o plano explicitamente escolhido e normaliza legado", async () => {
  const { source } = await fixture();
  for (const documentoId of [undefined, "6"]) {
    const result = await source.default({ searchParams: Promise.resolve({ pacienteId: "1", documentoId }) });
    assert.equal(result.props.documento.id, documentoId ? 6 : 7);
    assert.equal(result.props.documento.status, documentoId ? "Finalizado" : "Rascunho");
    assert.equal(result.props.documento.plano.dataInicio, "2026-10-01");
    assert.equal(result.props.documento.plano.blocos[0].objetivoEnsino, "Pedir ajuda");
    assert.equal(result.props.documento.updatedAt, "2026-10-05");
    assert.equal(result.props.planos[0].updatedAt, "2026-10-05");
    assert.equal(result.props.planos.length, 2);
    assert.ok(result.props.planos.every((item: object) => !("payload" in item)));
  }
});

test("Impressão individual apresenta estado vazio quando não há plano salvo", async () => {
  const { source } = await fixture({ empty: true });
  const result = await source.default({ searchParams: Promise.resolve({ pacienteId: "1" }) });
  assert.equal(result.props.documento, null);
  assert.deepEqual(result.props.planos, []);
});
