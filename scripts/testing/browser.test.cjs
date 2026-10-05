const assert = require("node:assert/strict");
const { test } = require("node:test");
const http = require("node:http");
const path = require("node:path");
const esbuild = require("esbuild");
const { chromium } = require("@playwright/test");
const { loadSource, root } = require("./load-source.cjs");

test("Plano de ensino: salvar rascunho, reabrir, corrigir e finalizar explicitamente no formulario real", async () => {
  const { expect } = require("@playwright/test");
  const fixtureModules = {
    "next/navigation": "export const useRouter=()=>({push(url){window.__destination=url;},refresh(){}});",
    "next/link": "export default function Link({children,...props}){return <a {...props}>{children}</a>;}",
    "@/app/(protected)/prontuario/prontuario.actions": `
      export const salvarDocumentoProntuarioAction = async (pacienteId, input) => {
        window.__writes.push({pacienteId,input});
        if(window.__fail) return {ok:false,error:'Falha sintetica ao salvar'};
        window.__saved={...input.payload,sourceDocumentId:input.documentoId||7};
        return {ok:true,data:{id:window.__saved.sourceDocumentId}};
      };
      export const excluirDocumentoProntuarioAction=async()=>({ok:true});
      export const excluirEvolucaoAction=async()=>({ok:true});
    `,
  };
  const bundle = await esbuild.build({
    stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';
      import{PlanoEnsinoFormClient}from'./src/app/(protected)/prontuario/[pacienteId]/plano-ensino/plano-ensino-form.client';
      import{TimelineClient}from'./src/app/(protected)/prontuario/[pacienteId]/timeline.client';
      const root=createRoot(document.getElementById('root'));let key=0;window.__writes=[];
      window.__render=(canFinalize=true)=>root.render(<PlanoEnsinoFormClient key={++key} pacienteId={1} canFinalize={canFinalize} initialData={window.__saved}/>);
      window.__timeline=()=>root.render(<TimelineClient pacienteId={1} canEditDocumento canDeleteDocumento={false} canEditEvolucao={false} canDeleteEvolucao={false}
        initialItems={['Rascunho','Finalizado'].map((status,index)=>({kind:'documento',id:index+1,tipo:'PLANO_ENSINO',titulo:status,status,version:1,data:'2026-10-02',profissional:'Sintetico'}))}/>);
      window.__render();`, resolveDir: path.join(root, "apps/web"), loader: "tsx" },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' }, tsconfig: path.join(root, "apps/web/tsconfig.json"), logLevel: "silent",
    plugins: [{ name: "plan-fixtures", setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (fixtureModules[args.path]) return { path: args.path, namespace: "fixture" };
        const match = /^@autismcad\/(validators|shared)\/(.*)$/.exec(args.path);
        if (match) return { path: path.join(root, "packages", match[1], "src", `${match[2]}.ts`) };
      });
      build.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({ contents: fixtureModules[args.path], loader: "jsx", resolveDir: path.join(root, "apps/web") }));
    } }],
  });
  const server = http.createServer((request, response) => {
    if (request.url === "/bundle.js") { response.setHeader("Content-Type", "application/javascript"); response.end(bundle.outputFiles[0].contents); return; }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end('<!doctype html><html lang="pt-BR"><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  let browser;
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
    const page = await browser.newPage(); const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByLabel("Habilidade", { exact: true }).fill("Comunicacao");
    await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__destination)).toBe("/prontuario/documento/7");
    assert.equal(await page.evaluate(() => window.__writes[0].input.status), "Rascunho");
    await expect(page.getByRole("button", { name: "Salvar rascunho", exact: true })).toBeDisabled();
    await page.evaluate(() => window.__render());
    await expect(page.getByLabel("Habilidade", { exact: true })).toHaveValue("Comunicacao");
    await page.getByLabel("Recursos", { exact: true }).fill("Informacao esquecida");
    await page.evaluate(() => { window.__fail=true; });
    await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Falha sintetica ao salvar");
    await expect(page.getByRole("textbox", { name: "Recursos", exact: true })).toHaveValue("Informacao esquecida");
    await page.evaluate(() => { window.__fail=false; });
    await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__writes.length)).toBe(3);
    assert.equal(await page.evaluate(() => window.__writes[2].input.documentoId), 7);
    await page.evaluate(() => window.__render());
    await expect(page.getByRole("textbox", { name: "Recursos", exact: true })).toHaveValue("Informacao esquecida");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Finalizar", exact: true }).click();
    assert.equal(await page.evaluate(() => window.__writes.length), 3);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Finalizar", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__writes.length)).toBe(4);
    assert.equal(await page.evaluate(() => window.__writes[3].input.status), "Finalizado");
    assert.equal(await page.evaluate(() => window.__writes[3].input.documentoId), 7);
    await page.evaluate(() => window.__render(false));
    await expect(page.getByRole("button", { name: "Finalizar", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Salvar rascunho", exact: true })).toBeEnabled();
    await page.evaluate(() => window.__timeline());
    await expect(page.getByRole("link", { name: "Editar", exact: true })).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Editar", exact: true })).toHaveAttribute("href", "/prontuario/1/plano-ensino?documentoId=1");
    await expect(page.getByRole("link", { name: "Imprimir", exact: true })).toHaveCount(2);
    await expect(page.getByRole("link", { name: "Imprimir", exact: true }).first()).toHaveAttribute("href", "/impressao/plano-ensino/individual?pacienteId=1&documentoId=1");
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
  }
});

test("Plano de ensino individual: impressão A4, campos completos, rascunho e texto longo sem corte", async () => {
  const { expect } = require("@playwright/test");
  const fs = require("node:fs");
  const fields = {
    habilidade: "Comunicação", ensino: "Pedir ajuda", objetivoEnsino: "Solicitar ajuda em atividades do cotidiano.",
    procedimento: "Apresentar a atividade.\nAguardar a solicitação da criança.", recursos: "Cartões e brinquedos",
    suportes: "Suporte verbal", alvo: "Solicitação funcional", objetivoEspecifico: "Solicitar ajuda de forma independente.",
    criterioSucesso: "Quatro acertos em cinco oportunidades.",
  };
  const document = {
    id: 7, titulo: "Plano de Ensino - Psicologia", status: "Rascunho", autorNome: "Profissional sintético",
    updatedAt: "2026-10-05", plano: { especialidade: "Psicologia", dataInicio: "2026-10-01", dataFinal: "2026-12-31", blocos: [fields] },
  };
  const bundle = await esbuild.build({
    stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';
      import{PlanoEnsinoDocumentoImpressaoClient}from'./src/app/impressao/plano-ensino/individual/plano-ensino-documento-impressao.client';
      const root=createRoot(document.getElementById('root'));window.__printCalls=0;window.print=()=>window.__printCalls++;
      window.__render=(doc)=>root.render(<PlanoEnsinoDocumentoImpressaoClient
        paciente={{id:1,nome:'Paciente sintético',dataNascimento:'2020-01-15'}}
        planos={doc?[doc,{...doc,id:6,status:'Finalizado'}]:[]} documento={doc}/>);
      window.__render(${JSON.stringify(document)});`, resolveDir: path.join(root, "apps/web"), loader: "tsx" },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' }, tsconfig: path.join(root, "apps/web/tsconfig.json"), logLevel: "silent",
    plugins: [{ name: "print-fixtures", setup(build) {
      build.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixture" }));
      build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export default function Link({children,...props}){return <a {...props}>{children}</a>;}", loader: "jsx", resolveDir: path.join(root, "apps/web") }));
      build.onResolve({ filter: /^@autismcad\/shared\// }, (args) => ({ path: path.join(root, "packages/shared/src", `${args.path.split('/').slice(2).join('/')}.ts`) }));
    } }],
  });
  const server = http.createServer((request, response) => {
    if (request.url === "/bundle.js") { response.setHeader("Content-Type", "application/javascript"); response.end(bundle.outputFiles[0].contents); return; }
    if (request.url === "/girassois.svg") { response.setHeader("Content-Type", "image/svg+xml"); response.end(fs.readFileSync(path.join(root, "apps/web/public/girassois.svg"))); return; }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end('<!doctype html><html lang="pt-BR"><head><style>body{margin:0;font-family:Arial,sans-serif}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  let browser;
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
    const page = await browser.newPage(); const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const sheet = page.getByRole("article", { name: "Plano de ensino para impressão" });
    await expect(sheet).toBeVisible();
    for (const text of Object.values(fields)) await expect(sheet).toContainText(text);
    await expect(sheet).toContainText("15/01/2020");
    await expect(sheet).toContainText("01/10/2026");
    await expect(sheet).toContainText("31/12/2026");
    await expect(sheet).toContainText("RASCUNHO");
    await expect(page.getByRole("combobox", { name: "Plano de ensino", exact: true })).toHaveValue("7");
    await page.getByRole("button", { name: "Imprimir / Salvar PDF" }).click();
    assert.equal(await page.evaluate(() => window.__printCalls), 1);
    await page.getByRole("combobox", { name: "Plano de ensino", exact: true }).selectOption("6");
    await page.getByRole("button", { name: "Abrir plano" }).click();
    await expect(page).toHaveURL(/\/impressao\/plano-ensino\/individual\?pacienteId=1&documentoId=6$/);
    await expect(sheet).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Imprimir / Salvar PDF" })).toBeHidden();
    await expect(sheet).toBeVisible();
    const { PDFDocument } = require("pdf-lib");
    const simplePdf = await page.pdf({ preferCSSPageSize: true });
    const simple = await PDFDocument.load(simplePdf);
    if (process.env.AUDIT_EVIDENCE_DIR) {
      fs.mkdirSync(process.env.AUDIT_EVIDENCE_DIR, { recursive: true });
      fs.writeFileSync(path.join(process.env.AUDIT_EVIDENCE_DIR, "plano-ensino-individual-a4.pdf"), simplePdf);
      await page.screenshot({ path: path.join(process.env.AUDIT_EVIDENCE_DIR, "plano-ensino-impressao.png"), fullPage: true });
    }
    assert.equal(simple.getPageCount(), 1);
    assert.ok(Math.abs(simple.getPage(0).getWidth() - 595.28) < 2);
    assert.ok(Math.abs(simple.getPage(0).getHeight() - 841.89) < 2);
    const longDocument = structuredClone(document);
    longDocument.status = "Finalizado";
    longDocument.plano.blocos = [0, 1].map((index) => ({ ...fields, procedimento: `Bloco ${index + 1}: ${"Procedimento detalhado para a atividade terapêutica. ".repeat(250)}FIM DO PROCEDIMENTO ${index + 1}` }));
    await page.evaluate((doc) => window.__render(doc), longDocument);
    await expect(sheet).not.toContainText("RASCUNHO");
    await expect(sheet).toContainText("FIM DO PROCEDIMENTO 2");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
    const longPdf = await page.pdf({ preferCSSPageSize: true });
    assert.ok((await PDFDocument.load(longPdf)).getPageCount() > 1);
    if (process.env.AUDIT_EVIDENCE_DIR) fs.writeFileSync(path.join(process.env.AUDIT_EVIDENCE_DIR, "plano-ensino-individual-longo.pdf"), longPdf);
    await page.emulateMedia({ media: "screen" });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
    await page.evaluate(() => window.__render(null));
    await expect(page.getByText("Nenhum plano de ensino salvo", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Imprimir / Salvar PDF" })).toHaveCount(0);
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
  }
});

test("Feriado e Recesso podem ser selecionados, salvos e reabertos no formulario real de atendimento", async () => {
  const fixtureModules = {
    "next/navigation": "export const useRouter=()=>({push(){},refresh(){}});",
    "@/app/(protected)/consultas/consultas.actions": `
      const items = [{
        id: 1, pacienteId: 1, profissionalId: 1, pacienteNome: 'Paciente sintetico',
        profissionalNome: 'Profissional sintetico', data: '2026-09-09', horaInicio: '17:00:00', horaFim: '18:00:00',
        isGrupo: false, turno: 'Vespertino', periodoInicio: '2026-08-01', periodoFim: '2026-12-31',
        presenca: 'Nao informado', realizado: false, statusRepasse: 'Pendente', motivo: null,
        observacoes: null, resumoRepasse: null
      }];
      export const listarAtendimentosAction = async () => ({ ok: true, data: { items: items.map(i => ({...i})) } });
      export const salvarAtendimentoAction = async (id, input) => {
        window.__savedAttendance = { id, input };
        Object.assign(items.find(i => i.id === id), input);
        return { ok: true, data: { id } };
      };
      export const criarAtendimentoAction = async () => ({ ok: true });
      export const excluirAtendimentoAction = async () => ({ ok: true });
      export const excluirDiaAtendimentosAction = async () => ({ ok: true });
    `,
  };
  const bundle = await esbuild.build({
    stdin: {
      contents: `import React from 'react';import{createRoot}from'react-dom/client';
        import{ConsultasClient}from'./src/app/(protected)/consultas/consultas.client';
        createRoot(document.getElementById('root')).render(<ConsultasClient
          initialProfissionais={[{id:1,nome:'Profissional sintetico'}]} initialPacientes={[{id:1,nome:'Paciente sintetico'}]}
          canCreateAtendimento canEditAtendimento canDeleteAtendimento={false} canEditRepasse={false}/>);`,
      resolveDir: path.join(root, "apps/web"), loader: "tsx",
    },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
    tsconfig: path.join(root, "apps/web/tsconfig.json"), logLevel: "silent",
    plugins: [{ name: "attendance-fixtures", setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (fixtureModules[args.path]) return { path: args.path, namespace: "fixture" };
        const match = /^@autismcad\/validators\/(.*)$/.exec(args.path);
        if (match) return { path: path.join(root, "packages/validators/src", `${match[1]}.ts`) };
      });
      build.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({ contents: fixtureModules[args.path], loader: "js" }));
    } }],
  });
  const server = http.createServer((request, response) => {
    if (request.url === "/bundle.js") { response.setHeader("Content-Type", "application/javascript"); response.end(bundle.outputFiles[0].contents); return; }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end('<!doctype html><html lang="pt-BR"><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  let browser;
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
    const page = await browser.newPage(); const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole("button", { name: "Editar atendimento", exact: true }).click();
    const dialog = page.getByRole("dialog");
    assert.deepEqual(await dialog.getByLabel("Presença").locator("option").allTextContents(), [
      "Nao informado", "Presente", "Ausente", "Feriado", "Recesso",
    ]);
    for (const presenca of ["Feriado", "Recesso"]) {
      await dialog.getByLabel("Presença").selectOption({ label: presenca });
      await dialog.getByRole("button", { name: "Salvar alteracoes", exact: true }).click();
      await require("@playwright/test").expect(dialog).toHaveCount(0);
      const saved = await page.evaluate(() => window.__savedAttendance);
      assert.equal(saved.id, 1);
      assert.equal(saved.input.presenca, presenca);
      assert.equal(saved.input.motivo, null);
      assert.equal(saved.input.periodoInicio, "2026-08-01");
      assert.equal(saved.input.periodoFim, "2026-12-31");
      await page.getByRole("button", { name: "Editar atendimento", exact: true }).click();
      await require("@playwright/test").expect(dialog.getByLabel("Presença")).toHaveValue(presenca);
    }
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
  }
});

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
