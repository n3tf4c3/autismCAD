import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveEffectiveRoleCanon } from "@/server/auth/effective-role";
import type { UserAccess } from "@/server/auth/access";

function access(overrides: Partial<UserAccess>): UserAccess {
  return {
    exists: true,
    role: null,
    canonicalRole: null,
    permissions: new Set<string>(),
    user: null,
    ...overrides,
  };
}

// Achado 40: o escopo de relatorios nao pode usar a role defasada do JWT quando
// ha `access` fresco do banco. Apos rebaixamento, o JWT pode manter ADMIN por ate
// 5 minutos; o papel efetivo deve vir do access.
test("usa canonicalRole do access fresco em vez da role defasada do JWT", () => {
  const result = resolveEffectiveRoleCanon(
    { id: 1, role: "ADMIN" },
    access({ role: "PROFISSIONAL", canonicalRole: "PROFISSIONAL" })
  );
  assert.equal(result, "PROFISSIONAL");
});

test("cai para access.role quando canonicalRole e nulo", () => {
  const result = resolveEffectiveRoleCanon(
    { id: 1, role: "ADMIN" },
    access({ role: "RECEPCAO", canonicalRole: null })
  );
  assert.equal(result, "RECEPCAO");
});

test("sem access, canonicaliza a role do usuario da sessao", () => {
  const result = resolveEffectiveRoleCanon({ id: 1, role: "admin" });
  assert.equal(result, "ADMIN");
});
