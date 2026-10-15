import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { PgDialect } from "drizzle-orm/pg-core";
import { ESPECIALIDADES_RELATORIO_PLANO_ENSINO } from "@autismcad/validators/relatorios/especialidades";
import { planoEnsinoQuerySchema } from "@autismcad/validators/relatorios/relatorios.schema";
import { AppError } from "@autismcad/shared/errors";

const require = createRequire(import.meta.url);
const { loadSource, queryResult } = require("../../../../scripts/testing/load-source.cjs");
const period = { from: "2026-10-01", to: "2026-10-31" };
const query = { pacienteId: 1, ...period };
const areas = [...ESPECIALIDADES_RELATORIO_PLANO_ENSINO, null];
const user = { id: 2 };
const access = {};

async function serviceFixture(options: { profissional?: boolean; denyPatient?: boolean } = {}) {
  const checks: number[] = [];
  const predicates: Array<{ sql: string; params: unknown[] }> = [];
  const joins: string[] = [];
  const documents = [...areas, "Psicologia"].map((especialidade, index) => ({
    id: index + 1, version: 1, status: "Finalizado", titulo: `Plano ${index + 1}`,
    payload: {
      especialidade: especialidade?.toUpperCase(),
      dataInicio: index === areas.length ? "2026-09-01" : period.from,
      dataFinal: index === areas.length ? "2026-09-30" : period.to,
      blocos: [{ habilidade: `Habilidade ${index + 1}` }],
    },
    createdAt: "2026-10-01T12:00:00Z", updatedAt: null, autorNome: "Profissional sintético",
  }));
  const evolutions = areas.map((especialidade, index) => ({
    id: index + 11, data: "2026-10-15", especialidade: especialidade?.toLowerCase() ?? null,
    payload: { itensDesempenho: [{ ensino: `Ensino ${index + 1}`, desempenho: "independente", tentativas: 5, acertos: index + 1 }] },
  }));
  const results = [
    ...(options.profissional ? [[{ id: 7, especialidade: "Psicologia" }]] : []),
    [{ id: 1, nome: "Paciente sintético", cpf: null, dataNascimento: null }],
    documents, evolutions,
  ];
  let reads = 0;
  const source = await loadSource("apps/web/src/server/modules/relatorios/relatorios.service.ts", {
    "@/lib/env": { env: { APP_TIMEZONE: "America/Cuiaba" } },
    "@/server/auth/effective-role": { resolveEffectiveRoleCanon: () => options.profissional ? "PROFISSIONAL" : "ADMIN_GERAL" },
    "@/server/modules/profissionais/profissionais.service": { obterProfissionalPorUsuario: async () => ({ id: 7 }) },
    "@/server/auth/paciente-access": { assertPacienteAccess: async (_user: unknown, pacienteId: number, loadedAccess: unknown) => {
      checks.push(pacienteId);
      assert.equal(loadedAccess, access);
      if (options.denyPatient) throw new AppError("Negado", 403, "FORBIDDEN");
    } },
    "@/db": { db: { select: () => {
      reads++;
      return queryResult(results.shift() ?? [], (method: string, args: unknown[]) => {
        const dialect = new PgDialect();
        if (method === "where") predicates.push(dialect.sqlToQuery(args[0] as Parameters<PgDialect["sqlToQuery"]>[0]));
        if (method === "leftJoin") joins.push(dialect.sqlToQuery(args[1] as Parameters<PgDialect["sqlToQuery"]>[0]).sql);
      });
    } } },
  });
  return { source, checks, predicates, joins, reads: () => reads };
}

test("Filtro de especialidade aceita as quatro áreas e mantém consultas anteriores", () => {
  assert.equal(planoEnsinoQuerySchema.parse(query).especialidade, undefined);
  for (const especialidade of ESPECIALIDADES_RELATORIO_PLANO_ENSINO) {
    assert.equal(planoEnsinoQuerySchema.parse({ ...query, especialidade }).especialidade, especialidade);
  }
  assert.equal(planoEnsinoQuerySchema.safeParse({ ...query, especialidade: "inexistente" }).success, false);
});

for (const [index, especialidade] of ESPECIALIDADES_RELATORIO_PLANO_ENSINO.entries()) {
  test(`Relatório de ${especialidade} filtra planos, resumo e desempenho juntos`, async () => {
    const { source, checks, joins } = await serviceFixture();
    const report = await source.consolidatePlanoEnsinoReport({ query: { ...query, especialidade }, user, access });
    assert.equal(report.especialidade, especialidade);
    assert.deepEqual(report.planos.map((row: { id: number }) => row.id), [index + 1]);
    assert.equal(report.resumo.totalPlanos, 1);
    assert.equal(report.resumo.totalBlocos, 1);
    assert.equal(report.resumo.ultimoPlano.id, index + 1);
    assert.deepEqual(report.desempenhoEnsino.map((row: { evolucaoId: number }) => row.evolucaoId), [index + 11]);
    assert.equal(report.desempenhoEnsino[0].acertos, index + 1);
    assert.deepEqual(checks, [1]);
    assert.ok(joins.some((sql) => sql.includes('"evolucoes"."profissional_id"')));
  });
}

test("Sem filtro, relatório preserva todas as áreas e registros sem especialidade", async () => {
  const { source } = await serviceFixture();
  const report = await source.consolidatePlanoEnsinoReport({ query, user, access });
  assert.equal(report.especialidade, null);
  assert.equal(report.planos.length, 5);
  assert.equal(report.desempenhoEnsino.length, 5);
});

test("Filtro de área mantém as restrições de autoria do profissional", async () => {
  const { source, predicates } = await serviceFixture({ profissional: true });
  await source.consolidatePlanoEnsinoReport({ query: { ...query, especialidade: "Fonoaudiologia" }, user, access });
  const docs = predicates.find((entry) => entry.sql.includes('"prontuario_documentos"."created_by_user_id"'));
  const evolutions = predicates.find((entry) => entry.sql.includes('"evolucoes"."profissional_id"'));
  assert.ok(docs?.params.includes(user.id));
  assert.ok(evolutions?.params.includes(7));
});

test("Relatório por área valida acesso ao paciente antes de ler dados", async () => {
  const { source, reads } = await serviceFixture({ denyPatient: true });
  await assert.rejects(source.consolidatePlanoEnsinoReport({ query: { ...query, especialidade: "Psicologia" }, user, access }), { status: 403 });
  assert.equal(reads(), 0);
});

test("DOCX recebe a especialidade validada pela rota e rejeita áreas desconhecidas", async () => {
  const received: unknown[] = [];
  const source = await loadSource("apps/web/src/app/api/relatorios/plano-ensino/docx/route.ts", {
    "@/server/auth/auth": { requirePermission: async (permission: string) => {
      assert.equal(permission, "relatorios_clinicos:export");
      return { user, access };
    } },
    "@/server/modules/relatorios/relatorios.service": { consolidatePlanoEnsinoReport: async (params: { query: unknown }) => {
      received.push(params.query);
      return { especialidade: "Psicopedagogia" };
    } },
    "@/server/modules/relatorios/plano-ensino-docx": { buildPlanoEnsinoDocx: async (report: { especialidade: string }) => {
      assert.equal(report.especialidade, "Psicopedagogia");
      return Buffer.from("synthetic-docx");
    } },
  });
  const response = await source.GET(new Request("http://localhost/api/relatorios/plano-ensino/docx?" + new URLSearchParams({ pacienteId: "1", ...period, especialidade: "Psicopedagogia" })));
  assert.equal(response.status, 200);
  assert.deepEqual(received, [{ ...query, especialidade: "Psicopedagogia" }]);
  const invalid = await source.GET(new Request("http://localhost/?pacienteId=1&especialidade=desconhecida"));
  assert.equal(invalid.status, 400);
  assert.equal(received.length, 1);
});

test("Arquivo DOCX identifica a especialidade e contém apenas o desempenho recebido", async () => {
  const source = await loadSource("apps/web/src/server/modules/relatorios/plano-ensino-docx.ts", {
    "@/lib/env": { env: { APP_TIMEZONE: "America/Cuiaba" } },
  });
  const { source: service } = await serviceFixture();
  const report = await service.consolidatePlanoEnsinoReport({ query: { ...query, especialidade: "Fonoaudiologia" }, user, access });
  const buffer = await source.buildPlanoEnsinoDocx(report);
  const zip = await require("jszip").loadAsync(buffer);
  const xml = await zip.file("word/document.xml").async("string");
  assert.ok(xml.includes("Especialidade: Fonoaudiologia"));
  assert.ok(xml.includes("Ensino 3"));
  assert.ok(!xml.includes("Ensino 1"));
});
