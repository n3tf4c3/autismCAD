import assert from "node:assert/strict";
import { test } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";

import {
  assertSeedWriteConfirmed,
  buildExistingSuperAdminUpdate,
} from "../../scripts/db/_seed-superadmin";

const LOCAL = "postgresql://user:pass@localhost:5432/autismcad";
const REMOTE = "postgresql://user:secret@db.neon.tech/autismcad";

test("seed de superadmin permite banco local sem confirmacao", () => {
  assert.doesNotThrow(() => assertSeedWriteConfirmed(LOCAL, [], {}));
});

test("seed de superadmin bloqueia banco remoto sem confirmacao e mascara credenciais", () => {
  assert.throws(
    () => assertSeedWriteConfirmed(REMOTE, [], {}),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /db\.neon\.tech\/autismcad/);
      assert.doesNotMatch(error.message, /user|secret/);
      assert.match(error.message, /--yes-prod/);
      return true;
    }
  );
});

test("seed de superadmin permite banco remoto com --yes-prod", () => {
  assert.doesNotThrow(() => assertSeedWriteConfirmed(REMOTE, ["--yes-prod"], {}));
});

test("update de superadmin existente incrementa tokenVersion na mesma escrita", () => {
  const updatedAt = new Date("2026-08-23T12:00:00.000Z");
  const update = buildExistingSuperAdminUpdate({
    nome: "Admin",
    senhaHash: "hash",
    updatedAt,
  });

  assert.equal(update.nome, "Admin");
  assert.equal(update.senhaHash, "hash");
  assert.equal(update.role, "admin-geral");
  assert.equal(update.ativo, true);
  assert.equal(update.updatedAt, updatedAt);

  const query = new PgDialect().sqlToQuery(update.tokenVersion);
  assert.equal(query.sql, '"users"."token_version" + 1');
  assert.deepEqual(query.params, []);
});
