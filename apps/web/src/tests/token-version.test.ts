import assert from "node:assert/strict";
import { test } from "node:test";

import { isMobileTokenRevoked } from "@/server/auth/token-version";

// Achado 103: token Bearer mobile e revogado quando a versao de credencial embutida
// nao bate mais com users.token_version (incrementada na troca de senha).

test("nao revoga quando a versao do token bate com a atual", () => {
  assert.equal(isMobileTokenRevoked({ tokenVersion: 3, currentVersion: 3 }), false);
});

test("revoga quando a versao do token e anterior a atual (senha trocada)", () => {
  assert.equal(isMobileTokenRevoked({ tokenVersion: 2, currentVersion: 3 }), true);
});

test("token sem claim 'ver' conta como versao 0 (compat de implantacao)", () => {
  assert.equal(isMobileTokenRevoked({ tokenVersion: null, currentVersion: 0 }), false);
  assert.equal(isMobileTokenRevoked({ tokenVersion: null, currentVersion: 1 }), true);
});
