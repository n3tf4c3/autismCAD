const assert = require("node:assert/strict");
const { test } = require("node:test");
const React = require("react");
const { act, create } = require("react-test-renderer");
const { loadSource } = require("../../../scripts/testing/load-source.cjs");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise((resolve) => setImmediate(resolve));
const user = (id) => ({ id, nome: `Synthetic ${id}`, email: `${id}@example.invalid`, role: "PROFISSIONAL" });
const tokens = (id) => ({ accessToken: `access-${id}`, refreshToken: `refresh-${id}`, user: user(id), expiresIn: 3600 });
const key = (suffix) => `autismcad.${suffix}`;

async function harness(request, customize = () => {}) {
  const client = await loadSource("apps/mobile/src/api/client.ts", { "@/config": { API_BASE_URL: "http://127.0.0.1:9" } }, "mobile");
  const storage = new Map();
  const secureStore = {
    getItemAsync: async (name) => storage.get(name) ?? null,
    setItemAsync: async (name, value) => { storage.set(name, value); },
    deleteItemAsync: async (name) => { storage.delete(name); },
  };
  customize(secureStore, storage);
  const module = await loadSource("apps/mobile/src/auth/AuthContext.tsx", {
    "expo-secure-store": secureStore,
    "@/api/client": { ...client, apiRequest: (path, options) => request(path, options, client.ApiError) },
  }, "mobile");
  let current, renderer;
  function Consumer() { current = module.useAuth(); return null; }
  await act(async () => { renderer = create(React.createElement(module.AuthProvider, null, React.createElement(Consumer))); await tick(); });
  return { get auth() { return current; }, storage, close: () => act(async () => { renderer.unmount(); }) };
}

test("#155 hidratacao atrasada nao restaura sessao depois do logout", async () => {
  const pending = deferred();
  const h = await harness(async () => ({}), (secure) => {
    secure.getItemAsync = async (name) => { await pending.promise; return name === key("user") ? JSON.stringify(user(1)) : "old-token"; };
  });
  try {
    let logout;
    await act(async () => { logout = h.auth.logout(); await tick(); });
    assert.equal(h.auth.user, null);
    await act(async () => { pending.resolve(); await logout; });
    assert.equal(h.auth.user, null); assert.equal(h.storage.size, 0); assert.equal(h.auth.loading, false);
  } finally { await h.close(); }
});

test("#155 refresh atrasado nao restaura sessao apos logout", async () => {
  const refresh = deferred(), started = deferred();
  const h = await harness(async (path, _options, ApiError) => {
    if (path.endsWith("login")) return tokens(1);
    if (path.endsWith("refresh")) { started.resolve(); return refresh.promise; }
    if (path.endsWith("logout")) return {};
    throw new ApiError("expired", 401);
  });
  try {
    await act(async () => { await h.auth.login("1", "synthetic"); });
    let result;
    await act(async () => { result = h.auth.authFetch("/protected").catch((error) => error); await started.promise; });
    await act(async () => { await h.auth.logout(); refresh.resolve(tokens(2)); await result; });
    assert.equal((await result).code, "ABORTED");
    assert.equal(h.auth.user, null); assert.equal(h.storage.size, 0);
  } finally { await h.close(); }
});

test("#155 login A atrasado nao sobrescreve login B", async () => {
  const first = deferred(), started = deferred();
  const h = await harness(async (path, options) => {
    if (!path.endsWith("login")) return {};
    if (options.body.email === "A") { started.resolve(); return first.promise; }
    return tokens(2);
  });
  try {
    let loginA;
    await act(async () => { loginA = h.auth.login("A", "synthetic").catch((error) => error); await started.promise; });
    await act(async () => { await h.auth.logout(); await h.auth.login("B", "synthetic"); first.resolve(tokens(1)); await loginA; });
    assert.equal((await loginA).code, "ABORTED");
    assert.equal(h.auth.user.id, 2); assert.equal(h.storage.get(key("accessToken")), "access-2");
  } finally { await h.close(); }
});

test("#155 escrita SecureStore em andamento termina antes da limpeza do logout", async () => {
  const write = deferred(), started = deferred();
  const h = await harness(async () => tokens(1), (secure, storage) => {
    secure.setItemAsync = async (name, value) => {
      if (name === key("accessToken")) { started.resolve(); await write.promise; }
      storage.set(name, value);
    };
  });
  try {
    let login, logout;
    await act(async () => { login = h.auth.login("A", "synthetic").catch((error) => error); await started.promise; });
    await act(async () => { logout = h.auth.logout(); await tick(); });
    assert.equal(h.auth.user, null);
    await act(async () => { write.resolve(); await Promise.all([login, logout]); });
    assert.equal(h.storage.size, 0); assert.equal((await login).code, "ABORTED");
  } finally { await h.close(); }
});

test("#155 duas respostas 401 compartilham um refresh e falha transitoria preserva sessao", async () => {
  const refresh = deferred(), started = deferred(); let refreshCount = 0, fail = false;
  const h = await harness(async (path, options, ApiError) => {
    if (path.endsWith("login")) return tokens(1);
    if (path.endsWith("refresh")) { refreshCount++; started.resolve(); if (fail) throw new ApiError("offline", 0, "TIMEOUT"); return refresh.promise; }
    if (options.token === "access-2" && !fail) return { ok: true };
    throw new ApiError("expired", 401);
  });
  try {
    await act(async () => { await h.auth.login("A", "synthetic"); });
    let requests;
    await act(async () => { requests = Promise.all([h.auth.authFetch("/a"), h.auth.authFetch("/b")]); await started.promise; await tick(); });
    assert.equal(refreshCount, 1);
    await act(async () => { refresh.resolve(tokens(2)); await requests; });
    assert.deepEqual(await requests, [{ ok: true }, { ok: true }]);
    fail = true;
    await act(async () => { await assert.rejects(h.auth.authFetch("/a"), { code: "TIMEOUT" }); });
    assert.equal(h.auth.user.id, 2); assert.equal(h.storage.get(key("refreshToken")), "refresh-2");
  } finally { await h.close(); }
});

test("#155 CONSENT_REQUIRED atrasado nao altera uma sessao nova", async () => {
  const response = deferred();
  const h = await harness(async (path, options, ApiError) => {
    if (path.endsWith("login")) return tokens(Number(options.body.email));
    if (path.endsWith("logout")) return {};
    await response.promise; throw new ApiError("consent", 403, "CONSENT_REQUIRED");
  });
  try {
    await act(async () => { await h.auth.login("1", "synthetic"); });
    const pending = h.auth.authFetch("/old").catch((error) => error);
    await act(async () => { await h.auth.login("2", "synthetic"); response.resolve(); await pending; });
    assert.equal((await pending).code, "ABORTED");
    assert.equal(h.auth.user.id, 2); assert.equal(h.auth.user.consentRequired, undefined);
  } finally { await h.close(); }
});

for (const kind of ["timeout", "abort"]) {
  test(`#113 ${kind} continua ativo durante leitura real do corpo HTTP`, async () => {
    const http = require("node:http");
    const headers = deferred();
    const server = http.createServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "application/json" }); response.write('{"ok":'); headers.resolve();
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const client = await loadSource("apps/mobile/src/api/client.ts", { "@/config": { API_BASE_URL: `http://127.0.0.1:${server.address().port}` } }, "mobile");
    const controller = new AbortController();
    try {
      const pending = client.apiRequest("/slow", { timeoutMs: kind === "timeout" ? 2000 : 10000, signal: controller.signal });
      const result = assert.rejects(pending, { code: kind === "timeout" ? "TIMEOUT" : "ABORTED" });
      await Promise.race([headers.promise, pending.catch(() => { throw new Error("HTTP nao chegou aos headers; teste nao validou o corpo"); })]);
      if (kind === "abort") controller.abort();
      await result;
    } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  });
}
