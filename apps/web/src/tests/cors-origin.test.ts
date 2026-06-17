import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveCorsAllowOrigin } from "@/lib/api/cors-origin";

// Achado 106: a API /api/v1 nao pode emitir Access-Control-Allow-Origin "*" por
// padrao em producao. So um origin explicito; fora de producao o coringa segue.

test("usa o origin configurado quando presente", () => {
  assert.equal(
    resolveCorsAllowOrigin({ configured: "https://app.exemplo.com", isProduction: true }),
    "https://app.exemplo.com"
  );
});

test("em producao sem configuracao retorna null (sem coringa)", () => {
  assert.equal(resolveCorsAllowOrigin({ configured: undefined, isProduction: true }), null);
});

test("fora de producao sem configuracao usa coringa", () => {
  assert.equal(resolveCorsAllowOrigin({ configured: undefined, isProduction: false }), "*");
});

test("ignora configuracao em branco", () => {
  assert.equal(resolveCorsAllowOrigin({ configured: "   ", isProduction: true }), null);
});
