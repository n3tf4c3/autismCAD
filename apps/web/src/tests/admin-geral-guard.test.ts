import assert from "node:assert/strict";
import { test } from "node:test";

import { blocksLastAdminGeralRemoval } from "@/server/modules/users/admin-geral-guard";

// Achado 102: excluir/rebaixar o ultimo admin-geral ativo deve ser bloqueado.
// O updateUser ja tinha o guard inline; o deleteUser nao tinha. Este teste fixa
// a invariante compartilhada para nao reincidir.

test("bloqueia quando o alvo e admin-geral e nao ha outro admin-geral ativo", () => {
  assert.equal(
    blocksLastAdminGeralRemoval({
      targetRoleCanon: "ADMIN_GERAL",
      otherActiveAdminGeralExists: false,
    }),
    true
  );
});

test("permite quando existe outro admin-geral ativo", () => {
  assert.equal(
    blocksLastAdminGeralRemoval({
      targetRoleCanon: "ADMIN_GERAL",
      otherActiveAdminGeralExists: true,
    }),
    false
  );
});

test("permite quando o alvo nao e admin-geral", () => {
  assert.equal(
    blocksLastAdminGeralRemoval({
      targetRoleCanon: "ADMIN",
      otherActiveAdminGeralExists: false,
    }),
    false
  );
});
