import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertSessionNotRevoked,
  isCredentialVersionRevoked,
} from "@/server/auth/token-version";

// Achado 103: token Bearer mobile e revogado quando a versao de credencial embutida
// nao bate mais com users.token_version (incrementada na troca de senha).
// Achado 131: a mesma regra passou a valer para a sessao de cookie da web.

test("nao revoga quando a versao do token bate com a atual", () => {
  assert.equal(isCredentialVersionRevoked({ tokenVersion: 3, currentVersion: 3 }), false);
});

test("revoga quando a versao do token e anterior a atual (senha trocada)", () => {
  assert.equal(isCredentialVersionRevoked({ tokenVersion: 2, currentVersion: 3 }), true);
});

test("token sem claim 'ver' conta como versao 0 (compat de implantacao)", () => {
  assert.equal(isCredentialVersionRevoked({ tokenVersion: null, currentVersion: 0 }), false);
  assert.equal(isCredentialVersionRevoked({ tokenVersion: null, currentVersion: 1 }), true);
});

// Achado 131: o guard usado pelos tres pontos de entrada da web (requireUser,
// requirePermission, requireAdminGeral) precisa negar com 401, e nao apenas devolver false.

test("guard de sessao web deixa passar quando a versao bate", () => {
  assert.doesNotThrow(() => assertSessionNotRevoked({ tokenVersion: 4, currentVersion: 4 }));
});

test("guard de sessao web nega com 401 apos a troca de senha", () => {
  assert.throws(
    () => assertSessionNotRevoked({ tokenVersion: 4, currentVersion: 5 }),
    (error: unknown) => {
      const appError = error as { status?: number; code?: string };
      assert.equal(appError.status, 401);
      assert.equal(appError.code, "SESSION_REVOKED");
      return true;
    }
  );
});

test("guard de sessao web preserva sessao sem claim quando nunca houve troca de senha", () => {
  assert.doesNotThrow(() => assertSessionNotRevoked({ tokenVersion: null, currentVersion: 0 }));
  assert.throws(() => assertSessionNotRevoked({ tokenVersion: null, currentVersion: 2 }));
});
