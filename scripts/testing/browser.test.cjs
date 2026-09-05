const assert = require("node:assert/strict");
const { test } = require("node:test");
const http = require("node:http");
const path = require("node:path");
const esbuild = require("esbuild");
const { chromium } = require("@playwright/test");
const { loadSource, root } = require("./load-source.cjs");

test("#153 formulario real consulta handler same-origin sob CSP e preserva edicao manual", async () => {
  const route = await loadSource("apps/web/src/app/api/cep/[cep]/route.ts", { "@/server/auth/auth": { requireUser: async () => ({ id: 1 }) }, "@/lib/env": { env: { NODE_ENV: "test" } } });
  const config = await loadSource("apps/web/next.config.ts");
  const headers = (await config.default.headers())[0].headers;
  const fixtureModules = {
    "next/navigation": "export const useRouter=()=>({push(){},refresh(){}});",
    "@/app/(protected)/profissionais/profissional.actions": "export const salvarProfissionalAction=async()=>({ok:true});",
  };
  const bundle = await esbuild.build({
    stdin: { contents: "import React from 'react';import{createRoot}from'react-dom/client';import{ProfissionalFormClient}from'./src/app/(protected)/profissionais/profissional-form.client';createRoot(document.getElementById('root')).render(<ProfissionalFormClient mode='create'/>);", resolveDir: path.join(root, "apps/web"), loader: "tsx" },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, tsconfig: path.join(root, "apps/web/tsconfig.json"), logLevel: "silent",
    plugins: [{ name: "fixtures", setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (fixtureModules[args.path]) return { path: args.path, namespace: "fixture" };
        const match = /^@autismcad\/validators\/(.*)$/.exec(args.path);
        if (match) return { path: path.join(root, "packages/validators/src", `${match[1]}.ts`) };
      });
      build.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({ contents: fixtureModules[args.path], loader: "js" }));
    } }],
  });
  const originalFetch = global.fetch; let calls = 0;
  global.fetch = async (url, options) => {
    assert.match(String(url), /^https:\/\/viacep.com.br\/ws\/\d{8}\/json\/$/); assert.ok(options.signal);
    return Response.json({ logradouro: "Rua do provedor", bairro: "Bairro sintético", localidade: "Cuiabá", uf: "MT" });
  };
  const server = http.createServer(async (request, response) => {
    for (const header of headers) response.setHeader(header.key, header.value);
    if (request.url === "/bundle.js") { response.setHeader("Content-Type", "application/javascript"); response.end(bundle.outputFiles[0].contents); return; }
    if (request.url.startsWith("/api/cep/")) {
      calls++;
      const result = await route.GET(new Request(`http://127.0.0.1${request.url}`), { params: Promise.resolve({ cep: request.url.split("/").at(-1) }) });
      response.statusCode = result.status; response.setHeader("Content-Type", "application/json"); response.end(await result.text()); return;
    }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end('<!doctype html><html lang="pt-BR"><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  let browser;
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
    const page = await browser.newPage(); const errors = [], requests = [];
    page.on("pageerror", (error) => errors.push(error.message)); page.on("request", (request) => requests.push(request.url()));
    await page.addInitScript(() => { window.__cspViolations = []; document.addEventListener("securitypolicyviolation", (e) => window.__cspViolations.push({ uri: e.blockedURI, directive: e.effectiveDirective })); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    await page.goto(origin);
    await page.locator('input[name="logradouro"]').fill("Rua digitada manualmente");
    await page.locator('input[name="cep"]').fill("78000000");
    await page.locator('input[name="cidade"]').waitFor();
    await require("@playwright/test").expect(page.locator('input[name="cidade"]')).toHaveValue("Cuiabá");
    assert.equal(await page.locator('input[name="logradouro"]').inputValue(), "Rua digitada manualmente");
    assert.ok(calls >= 1); assert.ok(requests.every((url) => url.startsWith(origin)));
    // Zod faz um probe opcional de JIT com Function e usa fallback quando CSP o bloqueia.
    // Verifica especificamente que o fluxo de CEP nao violou connect-src, sem ampliar a CSP.
    const violations = await page.evaluate(() => window.__cspViolations);
    assert.ok(violations.every((v) => v.uri === "eval" && v.directive === "script-src"));
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(async () => { try { await fetch("https://blocked.example.invalid"); return false; } catch { return true; } }), true);
  } finally { global.fetch = originalFetch; if (browser) await browser.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
});

test("#153 handler cancela corpo do provedor apos cinco segundos", async () => {
  const route = await loadSource("apps/web/src/app/api/cep/[cep]/route.ts", { "@/server/auth/auth": { requireUser: async () => ({ id: 1 }) }, "@/lib/env": { env: { NODE_ENV: "test" } } });
  const originalFetch = global.fetch;
  global.fetch = async (_url, { signal }) => ({ ok: true, json: () => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })) });
  // AbortSignal.timeout e unref; um timer de suporte evita fim prematuro do processo de teste.
  const keepAlive = setTimeout(() => {}, 10000);
  try {
    const started = performance.now();
    const result = await route.GET(new Request("http://localhost/api/cep/78000000"), { params: Promise.resolve({ cep: "78000000" }) });
    assert.equal(result.status, 502); assert.ok(performance.now() - started >= 4900); assert.ok(performance.now() - started < 9000);
  } finally { clearTimeout(keepAlive); global.fetch = originalFetch; }
});
