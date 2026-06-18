import assert from "node:assert/strict";
import { test } from "node:test";

import { consentGateBlocks } from "@/server/modules/consent/consent-gate";

// Achado 122: a API por token so libera dados quando o consentimento vigente foi aceito.
// As rotas de aceite da politica passam skipConsentGate para nao criar laco.

test("bloqueia quando consentimento e exigido e a rota nao e isenta", () => {
  assert.equal(
    consentGateBlocks({ consentRequired: true, skipConsentGate: false }),
    true
  );
});

test("nao bloqueia rota isenta (ex.: aceitar a politica) mesmo com consentimento pendente", () => {
  assert.equal(
    consentGateBlocks({ consentRequired: true, skipConsentGate: true }),
    false
  );
});

test("nao bloqueia quando o consentimento vigente ja foi aceito", () => {
  assert.equal(
    consentGateBlocks({ consentRequired: false, skipConsentGate: false }),
    false
  );
});
