import assert from "node:assert/strict";
import { test } from "node:test";

import { assertApplyConfirmed, maskDbTarget } from "../../scripts/db/_cleanup-safety";

const LOCAL = "postgresql://user:pass@localhost:5432/autismcad";
const REMOTE = "postgresql://user:pass@db.neon.tech/autismcad";

// Achado 98: nao expor credenciais no log; so host/database.
test("maskDbTarget retorna host/database sem credenciais", () => {
  assert.equal(maskDbTarget(REMOTE), "db.neon.tech/autismcad");
  assert.doesNotMatch(maskDbTarget(REMOTE), /pass/);
});

test("dry-run nunca exige confirmacao", () => {
  assert.doesNotThrow(() => assertApplyConfirmed(false, REMOTE, []));
});

test("apply em banco local nao exige confirmacao", () => {
  assert.doesNotThrow(() => assertApplyConfirmed(true, LOCAL, []));
});

test("apply em banco remoto sem confirmacao aborta", () => {
  assert.throws(() => assertApplyConfirmed(true, REMOTE, []), /confirmacao/);
});

test("apply em banco remoto com --yes-prod passa", () => {
  assert.doesNotThrow(() => assertApplyConfirmed(true, REMOTE, ["--yes-prod"]));
});
