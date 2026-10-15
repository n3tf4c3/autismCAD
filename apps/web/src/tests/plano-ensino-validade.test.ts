import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { PgDialect, type SelectedFields } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  diasAteVencimento,
  marcarPlanosEnsinoAtuais,
  selecionarAlertasPlanos,
  situacaoPlanoEnsino,
  type PlanoEnsinoListaItem,
} from "@/lib/prontuario/plano-ensino-validade";
import { AppError } from "@autismcad/shared/errors";

const { loadSource, queryResult } = createRequire(import.meta.url)("../../../../scripts/testing/load-source.cjs");
const hoje = "2026-10-15";
const base: PlanoEnsinoListaItem = {
  id: 1, pacienteId: 1, pacienteNome: "Paciente sintético", especialidade: "Psicologia",
  version: 1, status: "Finalizado", cadastradoEm: "2026-09-15",
  dataInicio: "2026-09-15", dataFinal: "2026-10-15", atual: true,
};

test("Vencimento usa dias de calendário, incluindo fim de mês e ano bissexto", () => {
  assert.equal(diasAteVencimento("2026-10-15", hoje), 0);
  assert.equal(diasAteVencimento("2026-10-14", hoje), -1);
  assert.equal(diasAteVencimento("2026-11-14", hoje), 30);
  assert.equal(diasAteVencimento("2024-03-01", "2024-02-28"), 2);
  assert.equal(diasAteVencimento("2027-01-01", "2026-12-31"), 1);
  assert.equal(diasAteVencimento("2026-02-31", hoje), null);
  assert.equal(diasAteVencimento(null, hoje), null);
});

test("Situação distingue vencido, vencimento hoje, limite do aviso e plano em dia", () => {
  assert.equal(situacaoPlanoEnsino({ ...base, dataFinal: "2026-10-14" }, hoje, 30).label, "Vencido há 1 dia");
  assert.equal(situacaoPlanoEnsino(base, hoje, 30).label, "Vence hoje");
  assert.equal(situacaoPlanoEnsino({ ...base, dataFinal: "2026-11-14" }, hoje, 30).tipo, "a_vencer");
  assert.equal(situacaoPlanoEnsino({ ...base, dataFinal: "2026-11-15" }, hoje, 30).tipo, "em_dia");
  assert.equal(situacaoPlanoEnsino({ ...base, dataFinal: null }, hoje, 30).tipo, "sem_data");
});

test("Planos atuais são independentes por paciente e especialidade; rascunho não substitui finalizado", () => {
  const plans = marcarPlanosEnsinoAtuais([
    { ...base, id: 3, version: 3, status: "Rascunho" },
    { ...base, id: 1, version: 1 },
    { ...base, id: 2, version: 2, especialidade: "  PSICOLOGIA " },
    { ...base, id: 4, version: 4, especialidade: "Fonoaudiologia" },
    { ...base, id: 5, version: 1, pacienteId: 2 },
  ]);
  assert.deepEqual(plans.filter((p) => p.atual).map((p) => p.id).sort(), [2, 4, 5]);
  assert.equal(situacaoPlanoEnsino(plans.find((p) => p.id === 1)!, hoje, 30).tipo, "historico");
  assert.equal(situacaoPlanoEnsino(plans.find((p) => p.id === 3)!, hoje, 30).tipo, "rascunho");
});

test("Dashboard inclui vencidos e datas ausentes, respeita prazo e exclui histórico e rascunho", () => {
  const plans = [
    { ...base, id: 1, dataFinal: "2026-10-14" },
    { ...base, id: 2, dataFinal: "2026-11-14" },
    { ...base, id: 3, dataFinal: "2026-11-15" },
    { ...base, id: 4, dataFinal: null },
    { ...base, id: 5, atual: false },
    { ...base, id: 6, status: "Rascunho" },
  ];
  assert.deepEqual(selecionarAlertasPlanos(plans, hoje, 30).map((p) => p.id), [1, 2, 4]);
  assert.deepEqual(selecionarAlertasPlanos(plans, hoje, 7).map((p) => p.id), [1, 4]);
});

async function fixture(options: { role?: string; denyPermission?: boolean; denyPatient?: boolean; noProfissional?: boolean } = {}) {
  const role = options.role ?? "ADMIN_GERAL";
  const access = { exists: true, canonicalRole: role, role, permissions: new Set(options.denyPermission ? [] : ["prontuario:view"]), user: { id: 2 } };
  const user = { id: 2 };
  const calls: string[] = [];
  const predicates: Array<{ sql: string; params: unknown[] }> = [];
  const selections: string[][] = [];
  const dialect = new PgDialect();
  const mockDb = drizzle.mock();
  function select(fields: Record<string, unknown>) {
    if (Object.keys(fields).length === 1) return mockDb.select(fields as SelectedFields);
    calls.push("select");
    selections.push(Object.keys(fields));
    return queryResult([{ ...base, createdAt: new Date("2026-10-15T02:00:00Z"), atual: undefined }], (method: string, args: unknown[]) => {
      if (method === "where") predicates.push(dialect.sqlToQuery(args[0] as Parameters<PgDialect["sqlToQuery"]>[0]));
    });
  }
  const source = await loadSource("apps/web/src/server/modules/prontuario/planos-ensino-lista.service.ts", {
    "@/lib/env": { env: { APP_TIMEZONE: "America/Cuiaba" } },
    "@/server/auth/access": { assertHasPermission: (loaded: typeof access, keys: string[]) => {
      assert.equal(loaded, access);
      assert.deepEqual(keys, ["prontuario:view"]);
      calls.push("permission");
      if (options.denyPermission) throw new AppError("Negado", 403, "FORBIDDEN");
    } },
    "@/server/auth/paciente-access": { assertPacienteAccess: async (_user: unknown, id: number, loaded: unknown) => {
      assert.equal(id, 1);
      assert.equal(loaded, access);
      calls.push("patient");
      if (options.denyPatient) throw new AppError("Negado", 403, "FORBIDDEN");
    } },
    "@/server/modules/profissionais/profissionais.service": { obterProfissionalPorUsuario: async () => options.noProfissional ? null : { id: 7 } },
    "@/db": { db: {
      select,
      selectDistinctOn: (_keys: unknown[], fields: Record<string, unknown>) => { calls.push("distinct"); return select(fields); },
    } },
  });
  return { source, user, access, calls, predicates, selections };
}

test("Lista do prontuário valida paciente e projeta somente metadados, com cadastro no fuso da clínica", async () => {
  const { source, user, access, calls, selections } = await fixture();
  const rows = await source.listarPlanosEnsinoComValidade({ user, access, pacienteId: 1 });
  assert.deepEqual(calls, ["permission", "patient", "select"]);
  assert.equal(rows[0].cadastradoEm, "2026-10-14");
  assert.equal(rows[0].dataFinal, base.dataFinal);
  assert.equal(rows[0].atual, true);
  assert.ok(!selections[0].includes("payload"));
});

test("Lista nega acesso antes da leitura para permissão ou paciente inválidos", async () => {
  for (const options of [{ denyPermission: true }, { denyPatient: true }]) {
    const { source, user, access, calls } = await fixture(options);
    await assert.rejects(source.listarPlanosEnsinoComValidade({ user, access, pacienteId: 1 }), { status: 403 });
    assert.ok(!calls.includes("select"));
  }
});

test("Dashboard busca último finalizado e exclui pacientes inativos e documentos apagados", async () => {
  const { source, user, access, calls, predicates } = await fixture();
  await source.listarPlanosEnsinoComValidade({ user, access });
  assert.ok(calls.includes("distinct"));
  assert.ok(predicates[0].sql.includes('"prontuario_documentos"."deleted_at" is null'));
  assert.ok(predicates[0].sql.includes('"pacientes"."ativo"'));
  assert.ok(predicates[0].params.includes("Finalizado"));
});

test("Dashboard do profissional restringe a consulta aos pacientes atendidos por ele", async () => {
  const { source, user, access, predicates } = await fixture({ role: "PROFISSIONAL" });
  await source.listarPlanosEnsinoComValidade({ user, access });
  const predicate = predicates.at(-1)!;
  assert.ok(predicate.sql.includes('"atendimentos"."profissional_id"'));
  assert.ok(predicate.sql.includes('"terapeutas"."ativo"'));
  assert.ok(predicate.params.includes(7));
});

test("Dashboard nega perfis fora do escopo e profissional sem vínculo", async () => {
  for (const options of [{ role: "RESPONSAVEL" }, { role: "desconhecido" }, { role: "PROFISSIONAL", noProfissional: true }]) {
    const { source, user, access, calls } = await fixture(options);
    await assert.rejects(source.listarPlanosEnsinoComValidade({ user, access }), { status: 403 });
    assert.ok(!calls.includes("select"));
  }
});
