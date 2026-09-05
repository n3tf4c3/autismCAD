import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { hasPermissionKey } from "@/server/auth/permissions";
import { criarEvolucaoSchema, atualizarEvolucaoSchema, evolucaoPayloadSchema } from "@autismcad/validators/prontuario/prontuario.schema";
import { patientFinalKey, patientUploadFilename } from "@/server/storage/patient-file-key";
const { loadSource, queryResult } = createRequire(import.meta.url)("../../../../scripts/testing/load-source.cjs");
const env = { NODE_ENV: "test", APP_TIMEZONE: "America/Cuiaba", R2_BUCKET: "synthetic", R2_ENDPOINT: "http://localhost:9", R2_ACCESS_KEY_ID: "synthetic", R2_SECRET_ACCESS_KEY: "synthetic", CRON_SECRET: "synthetic-cron-test-only", R2_TEMP_UPLOAD_RETENTION_HOURS: 24, R2_TEMP_UPLOAD_CLEANUP_BATCH_SIZE: 500 };

for (const value of ["abc", "Infinity", "NaN", -1, 1.5, "1e309", Number.POSITIVE_INFINITY, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
  test(`#114 contagem invalida rejeitada na criacao e edicao: ${String(value)}`, () => {
    const item = { tentativas: value, acertos: 0, opcao: "sim" };
    assert.equal(criarEvolucaoSchema.safeParse({ payload: { schemaVersion: 2, itensDesempenho: [item] } }).success, false);
    assert.equal(atualizarEvolucaoSchema.safeParse({ payload: { itens: [item] } }).success, false);
  });
}
test("#114 normaliza numero textual e vazio, valida relacao e preserva leitura historica", () => {
  const parsed = criarEvolucaoSchema.parse({ payload: { schemaVersion: 2, itensDesempenho: [{ tentativas: " 10 ", acertos: "2", opcao: "sim" }, { tentativas: " ", acertos: null }] } });
  assert.equal(parsed.payload.itensDesempenho?.[0].tentativas, 10);
  assert.equal(parsed.payload.itensDesempenho?.[0].acertos, 2);
  assert.equal(parsed.payload.itensDesempenho?.[1].tentativas, null);
  assert.equal(criarEvolucaoSchema.safeParse({ payload: { schemaVersion: 2, itensDesempenho: [{ tentativas: 1, acertos: 2 }] } }).success, false);
  assert.equal(evolucaoPayloadSchema.safeParse({ itens: [{ tentativas: "abc" }] }).success, true);
  assert.equal(criarEvolucaoSchema.safeParse({ payload: { schemaVersion: 2, comportamentos: { quantidades: { negativo: { gritos: "abc" } } } } }).success, false);
});

test("#149 promocao preserva UUID e respeita 255 caracteres inclusive com ID longo", () => {
  const leaf = "00000000-0000-0000-0000-000000000001-" + patientUploadFilename(Number.MAX_SAFE_INTEGER, "documento", "a".repeat(176) + ".pdf");
  assert.ok(`pacientes/temp/${Number.MAX_SAFE_INTEGER}/documento/${leaf}`.length <= 255);
  assert.ok(leaf.endsWith(".pdf"));
  const final = patientFinalKey(Number.MAX_SAFE_INTEGER, "documento", `pacientes/temp/${Number.MAX_SAFE_INTEGER}/documento/${leaf}`);
  assert.ok(final.length <= 255);
  assert.equal(final.split("/").at(-1), leaf);
  assert.throws(() => patientFinalKey(1, "foto", "pacientes/temp/2/foto/x.jpg"), { code: "FORBIDDEN" });
  assert.throws(() => patientFinalKey(1, "foto", `pacientes/temp/1/foto/${"a".repeat(256)}`), { code: "INVALID_FILE_KEY" });
});

test("#150 cadastro antigo nao escreve nenhuma referencia de anexo", async () => {
  const writes: Record<string, unknown>[] = [];
  const db = {
    select: () => queryResult([{ id: 1, foto: "pacientes/1/foto/new.jpg" }]),
    update: () => queryResult([{ id: 1 }], (key: string, args: Record<string, unknown>[]) => { if (key === "set") writes.push(args[0]); }),
    delete: () => queryResult([]),
  };
  const service = await loadSource("apps/web/src/server/modules/pacientes/pacientes.service.ts", {
    "@/lib/env": { env }, "@/db": { db }, "@/server/db/transaction": { runDbTransaction: (fn: (value: unknown) => unknown) => fn(db) },
  });
  await service.salvarPaciente({ nome: "Teste", cpf: "11111111111", convenio: "Particular", ativo: 1, terapias: [], fotoAtual: "pacientes/1/foto/old.jpg" }, 1);
  assert.equal(writes.length, 1);
  for (const key of ["foto", "laudo", "documento"]) assert.equal(Object.hasOwn(writes[0], key), false);
});

test("#151 cleanup e cron contabilizam erro por objeto e retornam 502", async () => {
  Object.assign(globalThis, { r2Client: { send: async (command: { constructor: { name: string } }) => command.constructor.name === "ListObjectsV2Command"
    ? { Contents: [{ Key: "pacientes/temp/test.pdf", LastModified: new Date(0), Size: 10 }] }
    : { Errors: [{ Key: "pacientes/temp/test.pdf", Code: "AccessDenied" }] } } });
  try {
    const route = await loadSource("apps/web/src/app/api/cron/r2-temp-cleanup/route.ts", { "@/lib/env": { env } });
    for (const method of ["GET", "POST"]) {
      const response = await route[method](new Request("http://localhost/api/cron", { method, headers: { authorization: `Bearer ${env.CRON_SECRET}` } }));
      assert.equal(response.status, 502);
      const result = await response.json();
      assert.equal(result.ok, false); assert.equal(result.deleted, 0); assert.equal(result.failed, 1);
    }
  } finally { Reflect.deleteProperty(globalThis, "r2Client"); }
});

test("#151 repete apenas objetos com erro transitorio e conta sucesso uma unica vez", async () => {
  const requests: string[][] = [];
  Object.assign(globalThis, { r2Client: { send: async (command: { input: { Delete: { Objects: { Key: string }[] } } }) => {
    requests.push(command.input.Delete.Objects.map((entry) => entry.Key));
    return requests.length === 1 ? { Errors: [{ Key: "b", Code: "SlowDown" }, { Key: "c", Code: "AccessDenied" }] } : {};
  } } });
  try {
    const r2 = await loadSource("apps/web/src/server/storage/r2.ts", { "@/lib/env": { env } });
    assert.deepEqual(await r2.deleteObjectsFromR2(["a", "a", "b", "c"]), { deleted: 2, failed: 1, codes: ["AccessDenied"] });
    assert.deepEqual(requests, [["a", "b", "c"], ["b"]]);
  } finally { Reflect.deleteProperty(globalThis, "r2Client"); }
});

test("#147 aliases e seed nao recriam presenca; editar consultas continua funcional", () => {
  assert.equal(hasPermissionKey(new Set(["consultas:presence"]), "atendimentos:edit"), false);
  assert.equal(hasPermissionKey(new Set(["consultas:edit"]), "atendimentos:edit"), true);
  const seed = readFileSync("scripts/db/seed-superadmin.ts", "utf8");
  assert.doesNotMatch(seed, /["']consultas:presence["']/);
  assert.ok(seed.includes('.where(or(ne(permissions.resource, "consultas"), ne(permissions.action, "presence")))'));
});

for (const method of ["POST", "PUT"]) {
  test(`#114 handler ${method} de evolucao rejeita contagem invalida antes da persistencia`, async () => {
    let writes = 0;
    const route = await loadSource(`apps/web/src/app/api/v1/evolucoes/${method === "PUT" ? "[id]/" : ""}route.ts`, {
      "@/lib/env": { env },
      "@/server/auth/api-auth": { requireApiPermission: async () => ({ user: { id: 1, role: "PROFISSIONAL" }, access: { canonicalRole: "PROFISSIONAL" } }) },
      "@/server/auth/paciente-access": { assertPacienteAccess: async () => ({ profissionalId: 1 }) },
      "@/server/modules/prontuario/prontuario.service": {
        criarEvolucao: async () => { writes++; }, atualizarEvolucao: async () => { writes++; },
        obterEvolucaoPorId: async () => ({ id: 1, pacienteId: 1, profissionalId: 1 }),
      },
    });
    const body = { ...(method === "POST" ? { pacienteId: 1 } : {}), payload: { schemaVersion: 2, itensDesempenho: [{ tentativas: "abc", acertos: 0, opcao: "sim" }] } };
    const response = await route[method](new Request("http://localhost/api/v1/evolucoes", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), { params: Promise.resolve({ id: "1" }) });
    assert.equal(response.status, 400); assert.equal(writes, 0);
  });
}
