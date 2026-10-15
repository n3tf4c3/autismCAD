const assert = require("node:assert/strict");
const { test } = require("node:test");
const http = require("node:http");
const path = require("node:path");
const esbuild = require("esbuild");
const { chromium } = require("@playwright/test");
const { loadSource, root } = require("./load-source.cjs");

test("Planos de ensino: lista de datas e alerta ajustável no dashboard, com preferência por usuário", async () => {
  const fs = require("node:fs");
  const { expect } = require("@playwright/test");
  const webRequire = require("node:module").createRequire(path.join(root, "apps/web/package.json"));
  const cssPath = path.join(root, "apps/web/src/app/globals.css");
  const css = await webRequire("postcss")([webRequire("@tailwindcss/postcss")({ base: path.join(root, "apps/web") })])
    .process(fs.readFileSync(cssPath, "utf8"), { from: cssPath });
  const base = { pacienteId: 1, pacienteNome: "Paciente sintético", version: 1, status: "Finalizado", cadastradoEm: "2026-09-01", dataInicio: "2026-09-01", atual: true };
  const plans = [
    { ...base, id: 1, especialidade: "Psicologia", dataFinal: "2026-10-14" },
    { ...base, id: 2, especialidade: "Fonoaudiologia", dataFinal: "2026-10-15" },
    { ...base, id: 3, especialidade: "Psicopedagogia", dataFinal: "2026-10-25" },
    { ...base, id: 4, especialidade: "Psicomotricidade", dataFinal: "2026-11-29" },
    { ...base, id: 5, especialidade: "Psicologia", dataFinal: "2026-09-30", atual: false },
    { ...base, id: 6, especialidade: "Musicoterapia", dataFinal: "2026-10-05", status: "Rascunho", atual: false },
    { ...base, id: 7, especialidade: "Fisioterapia", dataFinal: null },
  ];
  const bundle = await esbuild.build({
    stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';
      import{PlanosEnsinoAlertasClient}from'./src/app/(protected)/dashboard/planos-ensino-alertas.client';
      import{PlanosEnsinoListaClient}from'./src/components/prontuario/planos-ensino-lista.client';
      const root=createRoot(document.getElementById('root'));const plans=${JSON.stringify(plans)};
      window.__render=(userId=2,empty=false)=>root.render(<div key={userId} className="space-y-6">
        <PlanosEnsinoAlertasClient planos={empty?[]:plans} hoje="2026-10-15" userId={userId}/>
        <PlanosEnsinoListaClient planos={empty?[]:plans} hoje="2026-10-15" userId={userId} canAjustarAlerta/>
      </div>);window.__render();`, resolveDir: path.join(root, "apps/web"), loader: "tsx" },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' }, tsconfig: path.join(root, "apps/web/tsconfig.json"), logLevel: "silent",
    plugins: [{ name: "validade-fixtures", setup(build) {
      build.onResolve({ filter: /^@autismcad\/(validators|shared)\// }, (args) => {
        const [, group, relative] = /^@autismcad\/(validators|shared)\/(.*)$/.exec(args.path);
        return { path: path.join(root, "packages", group, "src", `${relative}.ts`) };
      });
      build.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixture" }));
      build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export default function Link({children,...props}){return <a {...props}>{children}</a>;}", loader: "jsx", resolveDir: path.join(root, "apps/web") }));
    } }],
  });
  const server = http.createServer((request, response) => {
    if (request.url === "/bundle.js") { response.setHeader("Content-Type", "application/javascript"); response.end(bundle.outputFiles[0].contents); return; }
    if (request.url === "/styles.css") { response.setHeader("Content-Type", "text/css"); response.end(css.css); return; }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end('<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body style="margin:0;font-family:Arial,sans-serif;background:#f5f5f5"><div id="root" style="max-width:1200px;margin:auto;padding:16px"></div><script src="/bundle.js"></script></body></html>');
  });
  let browser;
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
    const page = await browser.newPage({ viewport: { width: 1366, height: 1100 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const dashboard = page.getByRole("region", { name: "Vencimento dos planos de ensino" });
    const list = page.getByRole("region", { name: "Planos de ensino", exact: true });
    const lead = page.getByRole("combobox", { name: /Alertar com antecedência de/ });
    await expect(lead).toHaveValue("30");
    await expect(dashboard.getByRole("listitem")).toHaveCount(4);
    await expect(list.getByRole("listitem")).toHaveCount(7);
    await expect(list).toContainText("Vencido há 1 dia");
    await expect(list).toContainText("Vence hoje");
    await expect(list).toContainText("Histórico");
    await expect(list).toContainText("Rascunho");
    await expect(list.getByText("01/09/2026", { exact: true })).toHaveCount(14);
    await expect(dashboard).not.toContainText("Musicoterapia");
    await expect(list.getByRole("link", { name: "Abrir plano de Psicologia, versão 1", exact: true }).first()).toHaveAttribute("href", "/prontuario/documento/1");
    await expect(list.getByRole("link", { name: "Imprimir plano de Fonoaudiologia, versão 1", exact: true })).toHaveAttribute("href", "/impressao/plano-ensino/individual?pacienteId=1&documentoId=2");
    await expect(list.getByRole("link", { name: "Ajustar no dashboard" })).toHaveAttribute("href", "/dashboard#alertas-planos-ensino");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (process.env.AUDIT_EVIDENCE_DIR) {
      fs.mkdirSync(process.env.AUDIT_EVIDENCE_DIR, { recursive: true });
      await page.screenshot({ path: path.join(process.env.AUDIT_EVIDENCE_DIR, "planos-validade-desktop.png"), fullPage: true });
    }
    await lead.selectOption("7");
    await expect(dashboard.getByRole("listitem")).toHaveCount(3);
    await expect(list).toContainText("Alertas a partir de 7 dias");
    await page.reload();
    await expect(lead).toHaveValue("7");
    await page.evaluate(() => window.__render(3));
    await expect(lead).toHaveValue("30");
    await page.evaluate(() => window.__render(2));
    await expect(lead).toHaveValue("7");
    await lead.selectOption("60");
    await expect(dashboard.getByRole("listitem")).toHaveCount(5);
    await expect(list).toContainText("Vence em 45 dias");
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (process.env.AUDIT_EVIDENCE_DIR) await page.screenshot({ path: path.join(process.env.AUDIT_EVIDENCE_DIR, "planos-validade-mobile.png"), fullPage: true });
    await page.evaluate(() => {
      localStorage.setItem('autismcad:plano-ensino:antecedencia:2', 'invalido');
      window.dispatchEvent(new Event('storage'));
    });
    await expect(lead).toHaveValue("30");
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Storage blocked'); }; });
    await lead.selectOption("15");
    await expect(lead).toHaveValue("15");
    await expect(list).toContainText("Alertas a partir de 15 dias");
    await page.evaluate(() => window.__render(2, true));
    await expect(dashboard).toContainText("Nenhum plano vencido");
    await expect(list).toContainText("Nenhum plano de ensino cadastrado");
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
  }
});

test("Relatório do plano de ensino: especialidades, filtros aplicados, DOCX e impressão A4", async () => {
  const fs = require("node:fs");
  const { expect } = require("@playwright/test");
  const webRequire = require("node:module").createRequire(path.join(root, "apps/web/package.json"));
  const cssPath = path.join(root, "apps/web/src/app/globals.css");
  const css = await webRequire("postcss")([webRequire("@tailwindcss/postcss")({ base: path.join(root, "apps/web") })])
    .process(fs.readFileSync(cssPath, "utf8"), { from: cssPath });
  const bundle = await esbuild.build({
    stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';
      import{PlanoEnsinoImpressaoClient}from'./src/app/impressao/plano-ensino/plano-ensino-impressao.client';
      window.__queries=[];window.print=()=>window.__printed=document.querySelector('article').textContent;
      createRoot(document.getElementById('root')).render(<PlanoEnsinoImpressaoClient pacienteId={1} pacienteNome="Paciente sintético" canExportDocx/>);`,
      resolveDir: path.join(root, "apps/web"), loader: "tsx" },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' }, tsconfig: path.join(root, "apps/web/tsconfig.json"), logLevel: "silent",
    plugins: [{ name: "report-fixtures", setup(build) {
      build.onResolve({ filter: /^@autismcad\/validators\// }, (args) => ({ path: path.join(root, "packages/validators/src", `${args.path.split('/').slice(2).join('/')}.ts`) }));
      build.onResolve({ filter: /relatorios\.actions$/ }, () => ({ path: "action", namespace: "fixture" }));
      build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: `
        export async function gerarRelatorioPlanoEnsinoAction(query){
          window.__queries.push(query);
          if(window.__fail)return {ok:false,error:'Falha sintética ao carregar'};
          const especialidade=query.especialidade||null;
          return {ok:true,data:{report:{paciente:{id:1,nome:'Paciente sintético'},periodo:{from:query.from,to:query.to},especialidade,
            desempenhoEnsino:especialidade==='Psicomotricidade'?[]:[{evolucaoId:1,data:query.from,ensino:'Ensino de '+(especialidade||'todas as áreas'),desempenho:'independente',ajuda:'MOD',tentativas:5,acertos:4}]}}};
        }`, loader: "js" }));
    } }],
  });
  const server = http.createServer((request, response) => {
    if (request.url === "/bundle.js") { response.setHeader("Content-Type", "application/javascript"); response.end(bundle.outputFiles[0].contents); return; }
    if (request.url === "/styles.css") { response.setHeader("Content-Type", "text/css"); response.end(css.css); return; }
    if (request.url === "/girassois.svg") { response.setHeader("Content-Type", "image/svg+xml"); response.end(fs.readFileSync(path.join(root, "apps/web/public/girassois.svg"))); return; }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end('<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body style="margin:0;font-family:Arial,sans-serif"><div id="root" style="max-width:1024px;margin:auto;padding:16px"></div><script src="/bundle.js"></script></body></html>');
  });
  let browser;
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const specialty = page.getByRole("combobox", { name: "Especialidade", exact: true });
    const print = page.getByRole("button", { name: "Imprimir / Salvar PDF" });
    const docx = page.getByRole("button", { name: "Salvar DOCX", exact: true });
    const sheet = page.getByRole("article");
    await expect(print).toBeEnabled();
    await expect(specialty).toHaveValue("");
    await expect(sheet).toContainText("Todas as especialidades");
    for (const area of ["Psicologia", "Psicopedagogia", "Fonoaudiologia", "Psicomotricidade"]) {
      await specialty.selectOption(area);
      await expect(print).toBeDisabled();
      await expect(docx).toBeDisabled();
      await expect(page.getByRole("status")).toContainText("Atualize o relatório");
      await page.getByRole("button", { name: "Atualizar relatório" }).click();
      await expect(print).toBeEnabled();
      await expect(sheet).toContainText(area);
      assert.equal(await page.evaluate(() => window.__queries.at(-1).especialidade), area);
      if (area === "Psicomotricidade") await expect(sheet).toContainText("Sem evolucoes com metas de desempenho");
      else await expect(sheet).toContainText(`Ensino de ${area}`);
    }
    await specialty.selectOption("Psicologia");
    await page.getByRole("button", { name: "Atualizar relatório" }).click();
    await expect(print).toBeEnabled();
    await page.getByRole("combobox", { name: "Tipo de período", exact: true }).selectOption("custom");
    await page.getByLabel("Inicio", { exact: true }).fill("2026-10-01");
    await page.getByLabel("Fim", { exact: true }).fill("2026-10-15");
    await expect(print).toBeDisabled();
    await page.getByRole("button", { name: "Atualizar relatório" }).click();
    await expect(print).toBeEnabled();
    await expect(sheet).toContainText("01/10/2026 a 15/10/2026");
    await page.route("**/api/relatorios/plano-ensino/docx?*", async (route) => {
      const search = new URL(route.request().url()).searchParams;
      assert.equal(search.get("especialidade"), "Psicologia");
      assert.equal(search.get("from"), "2026-10-01");
      assert.equal(search.get("to"), "2026-10-15");
      await route.fulfill({ status: 200, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", body: "synthetic-docx" });
    });
    const downloadPromise = page.waitForEvent("download");
    await docx.click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), "relatorio-plano-ensino-1-psicologia.docx");
    await print.click();
    assert.ok((await page.evaluate(() => window.__printed)).includes("Psicologia"));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (process.env.AUDIT_EVIDENCE_DIR) {
      fs.mkdirSync(process.env.AUDIT_EVIDENCE_DIR, { recursive: true });
      await page.screenshot({ path: path.join(process.env.AUDIT_EVIDENCE_DIR, "relatorio-especialidade-desktop.png"), fullPage: true });
    }
    await page.emulateMedia({ media: "print" });
    await expect(specialty).toBeHidden();
    await expect(sheet).toBeVisible();
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    const document = await require("pdf-lib").PDFDocument.load(pdf);
    assert.ok(document.getPageCount() >= 1);
    assert.ok(Math.abs(document.getPage(0).getWidth() - 595.28) < 2);
    assert.ok(Math.abs(document.getPage(0).getHeight() - 841.89) < 2);
    if (process.env.AUDIT_EVIDENCE_DIR) fs.writeFileSync(path.join(process.env.AUDIT_EVIDENCE_DIR, "relatorio-psicologia-a4.pdf"), pdf);
    await page.emulateMedia({ media: "screen" });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(specialty).toBeVisible();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (process.env.AUDIT_EVIDENCE_DIR) await page.screenshot({ path: path.join(process.env.AUDIT_EVIDENCE_DIR, "relatorio-especialidade-mobile.png"), fullPage: true });
    await specialty.selectOption("");
    await page.getByRole("button", { name: "Atualizar relatório" }).click();
    await expect(sheet).toContainText("Todas as especialidades");
    await page.evaluate(() => { window.__fail = true; });
    await specialty.selectOption("Fonoaudiologia");
    await page.getByRole("button", { name: "Atualizar relatório" }).click();
    await expect(page.getByText("Falha sintética ao carregar", { exact: true })).toBeVisible();
    await expect(sheet).toHaveCount(0);
    await expect(print).toBeDisabled();
    await expect(docx).toBeDisabled();
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
  }
});

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
    await expect(page.getByLabel("Responsável Técnico(a)", { exact: true })).toHaveValue("");
    await page.getByLabel("Responsável Técnico(a)", { exact: true }).fill("  Técnica sintética  ");
    await page.getByLabel("Habilidade", { exact: true }).fill("Comunicacao");
    await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__destination)).toBe("/prontuario/documento/7");
    assert.equal(await page.evaluate(() => window.__writes[0].input.status), "Rascunho");
    assert.equal(await page.evaluate(() => window.__writes[0].input.payload.responsavelTecnico), "Técnica sintética");
    await expect(page.getByRole("button", { name: "Salvar rascunho", exact: true })).toBeDisabled();
    await page.evaluate(() => window.__render());
    await expect(page.getByLabel("Habilidade", { exact: true })).toHaveValue("Comunicacao");
    await expect(page.getByLabel("Responsável Técnico(a)", { exact: true })).toHaveValue("Técnica sintética");
    await page.getByLabel("Responsável Técnico(a)", { exact: true }).fill("Responsável corrigido");
    await page.getByLabel("Recursos", { exact: true }).fill("Informacao esquecida");
    await page.evaluate(() => { window.__fail=true; });
    await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Falha sintetica ao salvar");
    await expect(page.getByLabel("Responsável Técnico(a)", { exact: true })).toHaveValue("Responsável corrigido");
    await expect(page.getByRole("textbox", { name: "Recursos", exact: true })).toHaveValue("Informacao esquecida");
    await page.evaluate(() => { window.__fail=false; });
    await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__writes.length)).toBe(3);
    assert.equal(await page.evaluate(() => window.__writes[2].input.documentoId), 7);
    await page.evaluate(() => window.__render());
    await expect(page.getByRole("textbox", { name: "Recursos", exact: true })).toHaveValue("Informacao esquecida");
    await expect(page.getByLabel("Responsável Técnico(a)", { exact: true })).toHaveValue("Responsável corrigido");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Finalizar", exact: true }).click();
    assert.equal(await page.evaluate(() => window.__writes.length), 3);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Finalizar", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__writes.length)).toBe(4);
    assert.equal(await page.evaluate(() => window.__writes[3].input.status), "Finalizado");
    assert.equal(await page.evaluate(() => window.__writes[3].input.documentoId), 7);
    assert.equal(await page.evaluate(() => window.__writes[3].input.payload.responsavelTecnico), "Responsável corrigido");
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
    updatedAt: "2026-10-05", plano: { especialidade: "Psicologia", responsavelTecnico: "Técnica sintética", dataInicio: "2026-10-01", dataFinal: "2026-12-31", blocos: [fields] },
  };
  const bundle = await esbuild.build({
    stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';
      import{PlanoEnsinoDocumentoImpressaoClient}from'./src/app/impressao/plano-ensino/individual/plano-ensino-documento-impressao.client';
      const root=createRoot(document.getElementById('root'));window.__printCalls=0;window.print=()=>window.__printCalls++;
      window.__render=(doc,canCriarPlano=true)=>root.render(<PlanoEnsinoDocumentoImpressaoClient
        paciente={{id:1,nome:'Paciente sintético',dataNascimento:'2020-01-15'}}
        planos={doc?[doc,{...doc,id:6,status:'Finalizado'}]:[]} documento={doc} canCriarPlano={canCriarPlano}/>);
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
    await expect(sheet.locator(".plan-print-responsible")).toHaveText("Responsável Técnico(a)Técnica sintética");
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
    await expect(sheet).toContainText("Modelo em branco para preenchimento");
    await expect(sheet).toContainText("Paciente sintético");
    await expect(sheet).not.toContainText("RASCUNHO");
    for (const label of ["Responsável Técnico(a)", "Habilidade", "Ensino", "Objetivo de ensino", "Procedimento", "Recursos", "Suportes", "Alvo", "Objetivo específico", "Critério de sucesso"]) {
      await expect(sheet.getByText(label, { exact: true })).toHaveCount(1);
    }
    await expect(sheet.locator(".plan-print-responsible dd")).toHaveClass("plan-print-blank");
    await expect(page.getByRole("link", { name: "Criar plano de ensino" })).toHaveAttribute("href", "/prontuario/1/plano-ensino");
    const previousPrintCalls = await page.evaluate(() => window.__printCalls);
    await page.getByRole("button", { name: "Imprimir / Salvar PDF" }).click();
    assert.equal(await page.evaluate(() => window.__printCalls), previousPrintCalls + 1);
    await page.emulateMedia({ media: "print" });
    const blankPdf = await page.pdf({ preferCSSPageSize: true });
    assert.equal((await PDFDocument.load(blankPdf)).getPageCount(), 1);
    if (process.env.AUDIT_EVIDENCE_DIR) {
      fs.writeFileSync(path.join(process.env.AUDIT_EVIDENCE_DIR, "plano-ensino-modelo-em-branco.pdf"), blankPdf);
      await page.screenshot({ path: path.join(process.env.AUDIT_EVIDENCE_DIR, "plano-ensino-modelo-em-branco.png"), fullPage: true });
    }
    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => window.__render(null, false));
    await expect(page.getByRole("link", { name: "Criar plano de ensino" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Imprimir / Salvar PDF" })).toBeVisible();
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
