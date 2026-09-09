const assert = require("node:assert/strict");
const { before, after, test } = require("node:test");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const { migrate } = require("drizzle-orm/node-postgres/migrator");
const { loadSource, root } = require("./load-source.cjs");
const env = { NODE_ENV: "test", DATABASE_DRIVER: "neon-serverless", REQUIRE_DB_TRANSACTIONS: 1, APP_TIMEZONE: "America/Cuiaba" };
const servicePath = "apps/web/src/server/modules/users/users.service.ts";
const actionPath = "apps/web/src/app/(protected)/pacientes/paciente.actions.ts";
let pools, observer, databases, services;
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const fixtures = (db) => ({ "@/db": { db }, "@/lib/env": { env } });

before(async () => {
  assert.equal(process.env.AUDIT_ALLOW_DISPOSABLE_DB, "1", "Exige opt-in para banco descartavel; nunca use DATABASE_URL de producao");
  const url = new URL(process.env.TEST_DATABASE_URL ?? "http://invalid");
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname));
  assert.equal(url.pathname, "/autismcad_audit_test");
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol));
  pools = [0, 1, 2].map((i) => new Pool({ connectionString: url.toString(), max: 1, application_name: `autismcad-audit-${i}`, statement_timeout: 15000 }));
  observer = pools[2];
  assert.equal((await observer.query("select current_database() as name")).rows[0].name, "autismcad_audit_test");
  databases = pools.slice(0, 2).map((pool) => drizzle(pool));
  await migrate(databases[0], { migrationsFolder: path.join(root, "packages/db/src/migrations") });
  await observer.query("insert into roles(slug,nome) values ('admin-geral','Admin'),('profissional','Profissional') on conflict do nothing");
  services = await Promise.all(databases.map((db) => loadSource(servicePath, fixtures(db))));
});
after(async () => { if (pools) await Promise.all(pools.map((pool) => pool.end())); });

async function reset() {
  // Somente depois dos guards acima, no banco descartavel dedicado.
  await observer.query("truncate users, pacientes restart identity cascade");
  await observer.query("insert into users(id,nome,email,senha_hash,role) values (1,'Synthetic A','a@example.invalid','not-a-login-hash','admin-geral'),(2,'Synthetic B','b@example.invalid','not-a-login-hash','admin-geral')");
}
async function waitForLocks(count) {
  const until = Date.now() + 8000;
  while (Date.now() < until) {
    const result = await observer.query("select count(*)::int as count from pg_stat_activity where datname=current_database() and application_name in ('autismcad-audit-0','autismcad-audit-1') and wait_event_type='Lock'");
    if (result.rows[0].count >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  throw new Error(`Nao houve ${count} conexoes independentes bloqueadas; corrida nao demonstrada`);
}
const remainingAdmins = async () => Number((await observer.query("select count(*) as n from users where ativo and deleted_at is null and role='admin-geral'")).rows[0].n);
const update = (service, target, actor) => service.updateUser(target, { nome: "Synthetic", email: `${target}@example.invalid`, role: "profissional" }, actor);

for (const scenario of ["delete/delete", "update/update", "delete/update"]) {
  test(`#102 PostgreSQL concorrente ${scenario}: um admin permanece e ator perdedor e revalidado`, async () => {
    await reset();
    const pids = await Promise.all(pools.slice(0, 2).map(async (pool) => (await pool.query("select pg_backend_pid() as pid")).rows[0].pid));
    assert.notEqual(...pids);
    await observer.query("select pg_advisory_lock(74812001)");
    let pending;
    try {
      const [a, b] = scenario.split("/");
      pending = Promise.allSettled([
        a === "delete" ? services[0].deleteUser(2, 1) : update(services[0], 2, 1),
        b === "delete" ? services[1].deleteUser(1, 2) : update(services[1], 1, 2),
      ]);
      await waitForLocks(2);
    } finally { await observer.query("select pg_advisory_unlock(74812001)"); }
    const results = await pending;
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1, JSON.stringify(results));
    assert.equal(results.find((r) => r.status === "rejected").reason.code, "FORBIDDEN");
    assert.equal(await remainingAdmins(), 1);
  });
}

test("#102 controle negativo: retirar lock/revalidacao reproduz zero admins em duas conexoes", async () => {
  await reset();
  let reached = 0; const barrier = deferred();
  const fixture = { wait: async () => { if (++reached === 2) barrier.resolve(); await barrier.promise; } };
  const source = readFileSync(path.join(root, servicePath), "utf8").replaceAll("\r\n", "\n")
    .replaceAll("await lockAdminMembership(tx, requesterUserId);", "")
    ;
  // Escolhe rebaixamento: nenhum FK entre as linhas pode serializar acidentalmente a corrida.
  const demotionSource = source.replace("const [updated] = await tx", "await __fixtures.race.wait();\n      const [updated] = await tx");
  assert.notEqual(demotionSource, source, "Barreira precisa ficar apos as leituras e antes da escrita");
  const unsafe = await Promise.all(databases.map((db) => loadSource(servicePath, { ...fixtures(db), race: fixture }, "web", { [servicePath]: demotionSource })));
  const results = await Promise.allSettled([update(unsafe[0], 2, 1), update(unsafe[1], 1, 2)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 2, require("node:util").inspect(results));
  assert.equal(await remainingAdmins(), 0);
});

test("#131 aceite perde corrida real com revogacao atomicamente", async () => {
  await reset();
  const service = await loadSource("apps/web/src/server/modules/consent/consent.service.ts", fixtures(databases[0]));
  await pools[1].query("begin");
  await pools[1].query("update users set token_version=token_version+1 where id=1");
  const pending = service.acceptCurrentPolicy(1, 0).then(() => null, (error) => error);
  try { await waitForLocks(1); } finally { await pools[1].query("commit"); }
  assert.equal((await pending).code, "TOKEN_REVOKED");
  assert.equal((await observer.query("select politica_versao_aceita from users where id=1")).rows[0].politica_versao_aceita, null);
  await service.acceptCurrentPolicy(1, 1);
  assert.ok((await observer.query("select politica_versao_aceita from users where id=1")).rows[0].politica_versao_aceita);
});

test("#147 migracao idempotente remove somente presence e seus vinculos", async () => {
  await observer.query("insert into permissions(resource,action) values ('consultas','presence'),('consultas','edit'),('synthetic','view') on conflict do nothing");
  await observer.query("insert into role_permissions(role,permission_id) select 'profissional',id from permissions where resource in ('consultas','synthetic') on conflict do nothing");
  const sql = readFileSync(path.join(root, "packages/db/src/migrations/0012_remove_presence_permission.sql"), "utf8");
  const clinicalBefore = (await observer.query("select count(*)::int as n from pacientes")).rows[0].n;
  await observer.query(sql); await observer.query(sql);
  assert.equal((await observer.query("select count(*)::int as n from permissions where resource='consultas' and action='presence'")).rows[0].n, 0);
  assert.equal((await observer.query("select count(*)::int as n from role_permissions rp join permissions p on p.id=rp.permission_id where rp.role='profissional' and ((resource='consultas' and action='edit') or resource='synthetic')")).rows[0].n, 2);
  assert.equal((await observer.query("select count(*)::int as n from pacientes")).rows[0].n, clinicalBefore);
});

test("Ferias persiste na edicao, tem contagem propria e e preservada na exclusao em lote", async () => {
  await reset();
  await observer.query("insert into pacientes(id,nome,cpf) values(1,'Paciente sintetico','00000000000')");
  await observer.query("insert into terapeutas(id,nome,cpf) values(1,'Profissional sintetico','11111111111')");
  const attendance = await loadSource("apps/web/src/server/modules/atendimentos/atendimentos.service.ts", fixtures(databases[0]));
  const validators = await loadSource("packages/validators/src/atendimentos/atendimentos.schema.ts");
  const reports = await loadSource("apps/web/src/server/modules/relatorios/relatorios.service.ts", fixtures(databases[0]));
  const reportValidators = await loadSource("packages/validators/src/relatorios/relatorios.schema.ts");
  const input = validators.saveAtendimentoSchema.parse({
    pacienteId: 1, profissionalId: 1, data: "2099-01-05", horaInicio: "08:00", horaFim: "09:00",
    periodoInicio: "2099-01-01", periodoFim: "2099-01-31", presenca: "Nao informado",
  });
  const vacationId = await attendance.salvarAtendimento(input);
  await attendance.salvarAtendimento({ ...input, presenca: "Férias" }, vacationId);
  const persisted = (await attendance.listarAtendimentos({ pacienteId: 1 })).find((row) => row.id === vacationId);
  assert.equal(persisted.presenca, "Férias");
  assert.equal(Boolean(persisted.realizado), false);
  assert.equal(persisted.motivo, null);
  assert.equal(persisted.periodoInicio, input.periodoInicio);
  assert.equal(persisted.periodoFim, input.periodoFim);

  // A migration aceita o novo estado sem enfraquecer os dominios existentes.
  await assert.rejects(observer.query("update atendimentos set presenca='Invalido' where id=$1", [vacationId]), { code: "23514" });
  await assert.rejects(observer.query("update atendimentos set realizado=true where id=$1", [vacationId]), { code: "23514" });
  const user = { id: 1, role: "admin-geral" };
  const query = { from: "2099-01-01", to: "2099-01-31" };
  const vacationOnly = await reports.consolidateEvolutivoReport({ query: { ...query, pacienteId: 1 }, user });
  assert.equal(vacationOnly.indicadores.ferias, 1);
  assert.equal(vacationOnly.indicadores.tempoTotalMinutos, 0);
  assert.equal(vacationOnly.resumoAutomatico.regrasDisparadas.includes("MUITAS_FALTAS"), false);

  const presentId = await attendance.salvarAtendimento({ ...input, data: "2099-01-12", presenca: "Presente" });
  await attendance.salvarAtendimento({ ...input, data: "2099-01-19", presenca: "Ausente", motivo: "Motivo sintetico" });
  const plannedId = await attendance.salvarAtendimento({ ...input, data: "2099-01-26" });
  const report = await reports.consolidateAssiduidadeReport({ query, user });
  assert.deepEqual(report.resumo, { total: 4, presentes: 1, faltas: 1, ferias: 1, semRegistro: 1, devolutivasPendentes: 1, taxa: 50 });
  assert.equal(report.linhas[0].ferias, 1);
  assert.equal(report.linhas[0].neutros, 1);
  assert.deepEqual(report.pendenciasDevolutiva.map((row) => row.atendimentoId), [presentId]);
  const filtered = await reports.consolidateAssiduidadeReport({ query: reportValidators.assiduidadeQuerySchema.parse({ ...query, presenca: "Férias" }), user });
  assert.equal(filtered.resumo.total, 1);
  assert.equal(filtered.resumo.ferias, 1);
  assert.equal(filtered.resumo.semRegistro, 0);
  const evolutivo = await reports.consolidateEvolutivoReport({ query: { ...query, pacienteId: 1 }, user });
  assert.equal(evolutivo.indicadores.taxaPresencaPercent, 33.3);
  assert.equal(evolutivo.indicadores.tempoTotalMinutos, 180);
  assert.equal(evolutivo.distribuicao.porPresenca["Férias"], 1);

  const removed = await attendance.excluirDia({ ...input, diaSemana: new Date(`${input.data}T00:00:00Z`).getUTCDay() });
  assert.equal(removed.removidos, 1);
  const afterDelete = (await observer.query("select id::int,presenca,deleted_at from atendimentos order by id")).rows;
  assert.ok(afterDelete.find((row) => row.id === plannedId).deleted_at);
  assert.equal(afterDelete.find((row) => row.id === vacationId).deleted_at, null);
  const professionals = await loadSource("apps/web/src/server/modules/profissionais/profissionais.service.ts", fixtures(databases[0]));
  assert.equal(await professionals.contarAgendaFuturaProfissional(1), 0);
});

async function evolucaoHarness() {
  await reset();
  await observer.query("insert into pacientes(id,nome,cpf) values(1,'Paciente sintetico','00000000000')");
  await observer.query("insert into terapeutas(id,nome,cpf,usuario_id) values(1,'Profissional sintetico','11111111111',1),(2,'Outro profissional','22222222222',2)");
  const states = ["Nao informado", "Ausente", "Férias", "Presente"];
  for (const [index, presenca] of states.entries()) {
    await observer.query(`insert into atendimentos(id,paciente_id,profissional_id,data,hora_inicio,hora_fim,
      periodo_inicio,periodo_fim,presenca,realizado,motivo,observacoes)
      values($1,1,1,$2,'08:00','09:00','2099-01-01','2099-01-31',$3,$4,'Anotacao anterior','Observacao preservada')`,
    [index + 1, `2099-01-${String(5 + index * 7).padStart(2, "0")}`, presenca, presenca === "Presente"]);
  }
  await observer.query("insert into atendimentos(id,paciente_id,profissional_id,data,hora_inicio,hora_fim) values(5,1,2,'2099-01-05','09:00','10:00')");
  const user = { id: 1, role: "profissional" };
  const access = { canonicalRole: "PROFISSIONAL", profissionalId: 1 };
  const revalidated = [];
  const boundaries = {
    ...fixtures(databases[0]),
    "next/cache": { revalidatePath: (pathname) => revalidated.push(pathname) },
    "@/server/auth/auth": { requirePermission: async () => ({ user, access }) },
    "@/server/auth/api-auth": { requireApiPermission: async () => ({ user, access }) },
    "@/server/auth/paciente-access": { assertPacienteAccess: async (_user, pacienteId) => {
      assert.equal(pacienteId, 1); return { profissionalId: 1 };
    } },
  };
  const [service, web, post, put] = await Promise.all([
    loadSource("apps/web/src/server/modules/prontuario/prontuario.service.ts", boundaries),
    loadSource("apps/web/src/app/(protected)/prontuario/prontuario.actions.ts", boundaries),
    loadSource("apps/web/src/app/api/v1/evolucoes/route.ts", boundaries),
    loadSource("apps/web/src/app/api/v1/evolucoes/[id]/route.ts", boundaries),
  ]);
  return { service, web, post, put, user, revalidated };
}

const attendanceSnapshot = async () => (await observer.query("select * from atendimentos order by id")).rows;
const evolucaoRequest = (method, body) => new Request("http://localhost/api/v1/evolucoes", {
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

for (const channel of ["web", "api"]) {
  test(`Devolutiva ${channel}: criar e editar confirma presenca somente do atendimento vinculado`, async () => {
    const h = await evolucaoHarness();
    for (const atendimentoId of [1, 2, 3, 4]) {
      const before = await attendanceSnapshot();
      const input = { atendimentoId, payload: { schemaVersion: 2, descricao: "Devolutiva sintetica" } };
      let saved;
      if (channel === "web") {
        h.revalidated.length = 0;
        const result = await h.web.criarEvolucaoAction(1, input);
        assert.equal(result.ok, true, JSON.stringify(result)); saved = result.data;
        assert.ok(h.revalidated.includes("/consultas"));
      } else {
        const response = await h.post.POST(evolucaoRequest("POST", { pacienteId: 1, ...input }));
        const result = await response.json(); assert.equal(response.status, 201, JSON.stringify(result)); saved = result.data;
      }
      const after = await attendanceSnapshot();
      for (const [index, row] of after.entries()) {
        assert.deepEqual(row, Number(row.id) === atendimentoId
          ? { ...before[index], presenca: "Presente", realizado: true, status_repasse: "Concluido", updated_at: row.updated_at }
          : before[index]);
      }
      assert.equal(saved.data, before[atendimentoId - 1].data.toISOString().slice(0, 10));

      // Uma correcao de devolutiva legada tambem confirma a presenca.
      await observer.query("update atendimentos set presenca='Nao informado',realizado=false,status_repasse='Pendente' where id=$1", [atendimentoId]);
      const edit = { payload: { schemaVersion: 2, descricao: "Devolutiva corrigida" } };
      if (channel === "web") {
        h.revalidated.length = 0;
        const result = await h.web.atualizarEvolucaoAction(saved.id, edit);
        assert.equal(result.ok, true, JSON.stringify(result)); assert.ok(h.revalidated.includes("/consultas"));
      } else {
        const response = await h.put.PUT(evolucaoRequest("PUT", edit), { params: Promise.resolve({ id: String(saved.id) }) });
        assert.equal(response.status, 200, JSON.stringify(await response.json()));
      }
      const updated = (await attendanceSnapshot())[atendimentoId - 1];
      assert.deepEqual(updated, { ...after[atendimentoId - 1], updated_at: updated.updated_at });
    }
  });
}

test("Devolutiva sem atendimento, vinculo invalido e troca de sessao preservam os demais atendimentos", async () => {
  const h = await evolucaoHarness();
  const before = await attendanceSnapshot();
  await assert.rejects(h.service.criarEvolucao(1, { atendimentoId: 5, payload: {} }, h.user), { code: "INVALID_INPUT" });
  const saved = await h.service.criarEvolucao(1, { profissionalId: 1, data: "2099-01-05", payload: {} }, h.user);
  assert.deepEqual(await attendanceSnapshot(), before);
  await h.service.atualizarEvolucao(saved.id, { atendimentoId: 1 }, h.user);
  await h.service.atualizarEvolucao(saved.id, { atendimentoId: 2, data: "2099-01-12" }, h.user);
  const after = await attendanceSnapshot();
  assert.deepEqual(after.map(({ presenca, realizado, status_repasse }) => ({ presenca, realizado, status_repasse })), [
    { presenca: "Presente", realizado: true, status_repasse: "Pendente" },
    { presenca: "Presente", realizado: true, status_repasse: "Concluido" },
    ...before.slice(2).map(({ presenca, realizado, status_repasse }) => ({ presenca, realizado, status_repasse })),
  ]);
  await assert.rejects(h.service.criarEvolucao(1, { atendimentoId: 2, payload: {} }, h.user), { code: "CONFLICT" });
  assert.deepEqual(await attendanceSnapshot(), after);
  await h.service.excluirEvolucao(saved.id, 1);
  const deleted = (await attendanceSnapshot())[1];
  assert.deepEqual(deleted, { ...after[1], status_repasse: "Pendente", updated_at: deleted.updated_at });
});

test("Devolutiva: falha ao confirmar presenca desfaz criacao e edicao na mesma transacao", async () => {
  const h = await evolucaoHarness();
  const existing = await h.service.criarEvolucao(1, { profissionalId: 1, data: "2099-01-05", payload: { descricao: "Original" } }, h.user);
  const before = await attendanceSnapshot();
  const evolucoesBefore = (await observer.query("select * from evolucoes order by id")).rows;
  await observer.query("alter table atendimentos add constraint ck_test_presenca_failure check (id <> 1 or presenca <> 'Presente')");
  try {
    const isPresenceFailure = (error) => (error.cause?.code ?? error.code) === "23514";
    await assert.rejects(h.service.criarEvolucao(1, { atendimentoId: 1, payload: {} }, h.user), isPresenceFailure);
    await assert.rejects(h.service.atualizarEvolucao(existing.id, { atendimentoId: 1, payload: { descricao: "Alterada" } }, h.user), isPresenceFailure);
    assert.deepEqual(await attendanceSnapshot(), before);
    assert.deepEqual((await observer.query("select * from evolucoes order by id")).rows, evolucoesBefore);
  } finally {
    await observer.query("alter table atendimentos drop constraint ck_test_presenca_failure");
  }
});

async function storageHarness() {
  await reset();
  await observer.query("insert into pacientes(id,nome,cpf,foto) values(1,'Synthetic patient','00000000000','pacientes/1/foto/old.jpg')");
  const objects = new Map(["pacientes/1/foto/old.jpg", "pacientes/temp/1/foto/a.jpg", "pacientes/temp/1/foto/b.jpg"].map((key) => [key, { size: 10, contentType: "image/jpeg" }]));
  const storage = {
    ALLOWED_UPLOAD_CONTENT_TYPES: new Set(["image/jpeg"]), MAX_UPLOAD_BYTES: 20 * 1024 * 1024,
    normalizeUploadContentType: (s) => s, isAllowedUploadContentType: () => true,
    buildObjectKey: (prefix, filename) => `${prefix}/00000000-0000-0000-0000-000000000001-${filename}`,
    createSignedWriteUrl: async () => "http://127.0.0.1:9/synthetic-upload",
    createSignedReadUrl: async () => "http://127.0.0.1:9/synthetic-read",
    headObjectMetadataInR2: async (key) => objects.get(key) ?? null,
    copyObjectInR2: async ({ sourceKey, destinationKey }) => { assert.ok(objects.has(sourceKey)); objects.set(destinationKey, objects.get(sourceKey)); },
    deleteObjectFromR2: async (key) => { objects.delete(key); },
  };
  const actionFixtures = (db) => ({ ...fixtures(db), "@/server/storage/r2": storage, "next/cache": { revalidatePath() {} },
    "@/server/auth/auth": { requirePermission: async () => ({ user: { id: 1 }, access: {} }) },
    "@/server/auth/paciente-access": { assertPacienteAccess: async () => {} },
  });
  return { objects, storage, actionFixtures };
}

test("#149/#150 dois commits concorrentes e cadastro antigo preservam o anexo vigente", async () => {
  const h = await storageHarness(); const copied = deferred(), release = deferred();
  const copy = h.storage.copyObjectInR2;
  h.storage.copyObjectInR2 = async (input) => { await copy(input); if (input.sourceKey.endsWith("/a.jpg")) { copied.resolve(); await release.promise; } };
  const actions = await Promise.all(databases.map((db) => loadSource(actionPath, h.actionFixtures(db))));
  const first = actions[0].commitArquivoPacienteAction(1, { kind: "foto", key: "pacientes/temp/1/foto/a.jpg" });
  await copied.promise;
  const second = actions[1].commitArquivoPacienteAction(1, { kind: "foto", key: "pacientes/temp/1/foto/b.jpg" });
  try { await waitForLocks(1); } finally { release.resolve(); }
  assert.equal((await first).ok, true); assert.equal((await second).ok, true);
  const patientService = await loadSource("apps/web/src/server/modules/pacientes/pacientes.service.ts", fixtures(databases[0]));
  await patientService.salvarPaciente({ nome: "Synthetic updated", cpf: "00000000000", convenio: "Particular", ativo: 1, terapias: [], fotoAtual: "pacientes/1/foto/old.jpg" }, 1);
  const current = (await observer.query("select foto from pacientes where id=1")).rows[0].foto;
  assert.equal(current, "pacientes/1/foto/b.jpg"); assert.ok(h.objects.has(current));
  assert.equal(h.objects.has("pacientes/1/foto/old.jpg"), false); assert.equal(h.objects.has("pacientes/1/foto/a.jpg"), false);
  assert.equal((await actions[0].commitArquivoPacienteAction(1, { kind: "foto", key: "pacientes/1/foto/old.jpg" })).code, "STALE_FILE");
  assert.equal((await actions[0].commitArquivoPacienteAction(1, { kind: "foto", key: current })).ok, true);
  assert.ok(h.objects.has(current));
});

test("#150 rollback nao apaga chave que outro commit tornou vigente", async () => {
  const h = await storageHarness();
  const successful = await loadSource(actionPath, h.actionFixtures(databases[1]));
  let inject = true;
  const failing = await loadSource(actionPath, { ...h.actionFixtures(databases[0]), "@/server/db/transaction": {
    runDbTransaction: async (fn, options) => {
      if (inject && options.operation === "pacientes.arquivos.commit.action") {
        inject = false;
        try { await databases[0].transaction(async (tx) => { await fn(tx); throw new Error("synthetic rollback after copy"); }); }
        catch (error) {
          assert.equal((await successful.commitArquivoPacienteAction(1, { kind: "foto", key: "pacientes/temp/1/foto/a.jpg" })).ok, true);
          throw error;
        }
      }
      return databases[0].transaction(fn);
    },
  } });
  const result = await failing.commitArquivoPacienteAction(1, { kind: "foto", key: "pacientes/temp/1/foto/a.jpg" });
  assert.equal(result.ok, false);
  const current = (await observer.query("select foto from pacientes where id=1")).rows[0].foto;
  assert.equal(current, "pacientes/1/foto/a.jpg"); assert.ok(h.objects.has(current));
});
