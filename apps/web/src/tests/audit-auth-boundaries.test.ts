import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { AppError, toAppError } from "@autismcad/shared/errors";
import { CURRENT_PRIVACY_POLICY_VERSION } from "@autismcad/shared/policy";

const { loadSource, queryResult } = createRequire(import.meta.url)("../../../../scripts/testing/load-source.cjs");
const env = { NODE_ENV: "test", APP_TIMEZONE: "America/Cuiaba" };

function sessionFixtures(options: { revoked?: boolean; pending?: boolean; inactive?: boolean } = {}) {
  return {
    "@/lib/env": { env },
    "@/server/auth/session": { getAuthSession: async () => ({ user: { id: "2", role: "profissional", tokenVersion: 1 } }) },
    "@/db": { db: { select: () => queryResult(options.inactive ? [] : [{ id: 2, nome: "Teste", role: "admin-geral", tokenVersion: options.revoked ? 2 : 1, versao: options.pending ? "antiga" : CURRENT_PRIVACY_POLICY_VERSION }]) } },
  };
}

for (const documentoId of [undefined, 7]) {
  for (const allowed of [false, true]) {
    test(`#16 salvar ${documentoId ? "versao" : "novo"} exige finalize (${allowed})`, async () => {
      const writes: unknown[] = [];
      const checks: string[] = [];
      const source = await loadSource("apps/web/src/app/(protected)/prontuario/prontuario.actions.ts", {
        "@/lib/env": { env },
        "@/db": { db: {} },
        "@autismcad/shared/errors": { AppError, toAppError },
        "next/cache": { revalidatePath() {} },
        "@/server/auth/auth": { requirePermission: async (key: string) => {
          checks.push(key);
          if (key === "prontuario:finalize" && !allowed) throw new AppError("Negado", 403, "FORBIDDEN");
          return { user: { id: 2 }, access: {} };
        } },
        "@/server/auth/paciente-access": { assertPacienteAccess: async () => {} },
        "@/server/modules/prontuario/prontuario.service": {
          salvarDocumento: async (...args: unknown[]) => { writes.push(args); return { id: 7 }; },
          obterDocumento() {}, excluirDocumento() {}, finalizarDocumento() {},
          criarEvolucao() {}, atualizarEvolucao() {}, obterEvolucaoPorId() {}, excluirEvolucao() {},
        },
      });
      const result = await source.salvarDocumentoProntuarioAction(1, { tipo: "OUTRO", documentoId, status: "Finalizado", payload: {} });
      assert.equal(result.ok, allowed);
      assert.equal(writes.length, allowed ? 1 : 0);
      assert.deepEqual(checks, [documentoId ? "prontuario:version" : "prontuario:create", "prontuario:finalize"]);
    });
  }
}

for (const guard of ["requireUser", "requirePermission", "requireAdminGeral"]) {
  test(`#122 ${guard} exige consentimento na fronteira`, async () => {
    const auth = await loadSource("apps/web/src/server/auth/auth.ts", sessionFixtures({ pending: true }));
    await assert.rejects(auth[guard](...(guard === "requirePermission" ? ["prontuario:view"] : [])), { code: "CONSENT_REQUIRED", status: 403 });
  });
}

for (const options of [{ revoked: true }, { inactive: true }]) {
  test(`#131 aceite web revalida a sessao ${JSON.stringify(options)}`, async () => {
    let writes = 0;
    const fixtures = sessionFixtures(options);
    const action = await loadSource("apps/web/src/app/consentimento/consentimento.actions.ts", {
      ...fixtures,
      "@/db": { db: { ...fixtures["@/db"].db, update: () => { writes++; return queryResult([{ id: 2 }]); } } },
      "next/navigation": { redirect() { throw new Error("redirect"); } },
    });
    await assert.rejects(action.aceitarConsentimentoAction(), { status: 401 });
    assert.equal(writes, 0);
  });
}

test("#131 escrita de aceite que perdeu a corrida com revogacao retorna 401", async () => {
  const service = await loadSource("apps/web/src/server/modules/consent/consent.service.ts", {
    "@/db": { db: { update: () => queryResult([]) } },
  });
  await assert.rejects(service.acceptCurrentPolicy(2, 1), { status: 401, code: "TOKEN_REVOKED" });
});

test("#122 consentimento pendente permite somente a excecao explicita de aceite", async () => {
  const auth = await loadSource("apps/web/src/server/auth/auth.ts", sessionFixtures({ pending: true }));
  assert.equal((await auth.requireUser({ skipConsentGate: true })).id, 2);
});

for (const path of ["evolutivo/pdf", "evolutivo/docx", "plano-ensino/docx"]) {
  test(`#122 handler de exportacao ${path} bloqueia consentimento pendente`, async () => {
    const route = await loadSource(`apps/web/src/app/api/relatorios/${path}/route.ts`, sessionFixtures({ pending: true }));
    const response = await route.GET(new Request("http://localhost/api/relatorios/?pacienteId=1"));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "CONSENT_REQUIRED");
  });
}

for (const name of ["devolutiva", "plano-ensino"]) {
  test(`#122 pagina de impressao ${name} bloqueia consentimento pendente`, async () => {
    const componentName = name === "devolutiva" ? "DevolutivaImpressaoClient" : "PlanoEnsinoImpressaoClient";
    const page = await loadSource(`apps/web/src/app/impressao/${name}/page.tsx`, {
      ...sessionFixtures({ pending: true }),
      [`@/app/impressao/${name}/${name}-impressao.client`]: { [componentName]: () => null },
    });
    await assert.rejects(page.default({ searchParams: Promise.resolve({ pacienteId: "1" }) }), { code: "CONSENT_REQUIRED" });
  });
}

test("#122 action clinica real nega mutacao com consentimento pendente", async () => {
  let writes = 0;
  const fixtures = sessionFixtures({ pending: true });
  const action = await loadSource("apps/web/src/app/(protected)/prontuario/prontuario.actions.ts", {
    ...fixtures,
    "@/db": { db: { ...fixtures["@/db"].db, insert: () => { writes++; return queryResult([{ id: 1 }]); } } },
    "next/cache": { revalidatePath() {} },
  });
  const result = await action.salvarDocumentoProntuarioAction(1, { tipo: "OUTRO", status: "Rascunho", payload: {} });
  assert.equal(result.code, "CONSENT_REQUIRED"); assert.equal(writes, 0);
});

for (const revoked of [false, true]) {
  test(`#131 handler Bearer de aceite usa versao autenticada (revogado=${revoked})`, async () => {
    let writes = 0;
    const route = await loadSource("apps/web/src/app/api/v1/consentimento/route.ts", {
      "@/lib/env": { env },
      "@/server/auth/api-token": { verifyAccessToken: async () => ({ sub: "2", tokenVersion: 1 }) },
      "@/server/auth/access": { loadUserAccess: async () => ({ exists: true, tokenVersion: revoked ? 2 : 1, user: { id: 2, nome: "Synthetic" }, role: "PROFISSIONAL" }), assertHasPermission() {} },
      "@/db": { db: { update: () => { writes++; return queryResult([{ id: 2 }]); } } },
    });
    const response = await route.POST(new Request("http://localhost/api/v1/consentimento", { method: "POST", headers: { authorization: "Bearer synthetic" } }));
    assert.equal(response.status, revoked ? 401 : 200); assert.equal(writes, revoked ? 0 : 1);
  });
}

test("#131 pagina de aceite revogada redireciona ao login sem tela de erro", async () => {
  const page = await loadSource("apps/web/src/app/consentimento/page.tsx", {
    ...sessionFixtures({ revoked: true }),
    "next/link": { default: () => null },
    "next/navigation": { redirect: (url: string) => { throw new Error(`redirect:${url}`); } },
  });
  await assert.rejects(page.default(), /redirect:\/login/);
});
