import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import { createRequire } from "node:module";
import { inspect } from "node:util";
import { PgDialect } from "drizzle-orm/pg-core";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { compare } from "bcryptjs";

// Achado 159: o upgrade do hash legado (SHA-256 -> bcrypt) no login nao pode
// sobrescrever uma troca de senha que aconteceu entre a leitura e o UPDATE.
// Achado 158: falha nesse UPDATE nao copia params para o log.

const require = createRequire(import.meta.url);
const { loadSource } = require("../../../../scripts/testing/load-source.cjs");

const OLD_PASSWORD = "senha-antiga-159";
const NEW_PASSWORD = "senha-nova-159";
const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

type Row = {
  id: number; nome: string; email: string; senhaHash: string; role: string;
  ativo: boolean; tokenVersion: number; deletedAt: Date | null;
};

const COLUMNS: Record<string, keyof Row> = {
  id: "id", senha_hash: "senhaHash", token_version: "tokenVersion", ativo: "ativo", deleted_at: "deletedAt",
};

// Avalia o predicado que o codigo real gerou contra a linha "atual" do banco simulado.
function predicateMatches(row: Row, where: unknown): boolean {
  const { sql, params } = new PgDialect().sqlToQuery(where as Parameters<PgDialect["sqlToQuery"]>[0]);
  const clauses = [...sql.matchAll(/"users"\."(\w+)" (= \$(\d+)|is null)/g)];
  assert.ok(clauses.length > 0, `predicado inesperado: ${sql}`);
  return clauses.every(([, column, op, index]) => {
    const value = row[COLUMNS[column]];
    return op === "is null" ? value === null : value === params[Number(index) - 1];
  });
}

async function loginFixture(options: { concurrentChange?: boolean; updateError?: unknown } = {}) {
  const row: Row = {
    id: 9, nome: "Usuario sintetico", email: "sintetico@exemplo.invalid", senhaHash: sha256(OLD_PASSWORD),
    role: "PROFISSIONAL", ativo: true, tokenVersion: 0, deletedAt: null,
  };
  const attempts: string[] = [];
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => {
      const snapshot = { ...row };
      if (options.concurrentChange) {
        // Troca administrativa de senha entre o SELECT e o UPDATE do login.
        row.senhaHash = sha256(NEW_PASSWORD);
        row.tokenVersion += 1;
      }
      return [snapshot];
    } }) }) }),
    update: () => ({ set: (values: { senhaHash: string }) => {
      const apply = (where: unknown) => {
        if (options.updateError) throw options.updateError;
        if (!predicateMatches(row, where)) return [];
        row.senhaHash = values.senhaHash;
        return [{ id: row.id }];
      };
      // Thenable preguicoso: aceita tanto `await ...where()` quanto `.returning()`.
      return { where: (where: unknown) => ({
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve().then(() => apply(where)).then(resolve, reject),
        returning: async () => apply(where),
      }) };
    } }),
  };
  const source = await loadSource("apps/web/src/server/auth/credentials.ts", {
    "@/db": { db },
    "@/lib/env": { env: { BCRYPT_COST: 4, NODE_ENV: "test" } },
    "@/server/modules/access-logs/access-logs.service": {
      isLoginRateLimited: async () => false,
      recordLoginAttemptAccess: async (params: { status: string }) => { attempts.push(params.status); },
    },
  });
  return { source, row, attempts };
}

test("controle: sem concorrencia, o login migra o hash legado para bcrypt", async () => {
  const { source, row, attempts } = await loginFixture();
  const user = await source.verifyCredentials({ email: row.email, password: OLD_PASSWORD });
  assert.equal(user?.id, 9);
  assert.ok(row.senhaHash.startsWith("$2"), "hash nao migrou para bcrypt");
  assert.equal(await compare(OLD_PASSWORD, row.senhaHash), true);
  assert.deepEqual(attempts, ["SUCESSO"]);
});

test("troca concorrente de senha nao e sobrescrita pelo upgrade do hash legado", async () => {
  const { source, row, attempts } = await loginFixture({ concurrentChange: true });
  const user = await source.verifyCredentials({ email: row.email, password: OLD_PASSWORD });

  assert.equal(row.senhaHash, sha256(NEW_PASSWORD), "a senha nova foi sobrescrita pela antiga");
  assert.equal(row.tokenVersion, 1);
  assert.equal(user, null, "login com a senha antiga nao pode ser aceito apos a troca");
  assert.deepEqual(attempts, ["FALHA"]);
});

test("falha no UPDATE do upgrade mantem o login e nao loga params", async () => {
  const marker = "MARCADOR-SINTETICO-159";
  const updateError = new DrizzleQueryError('update "users" set "senha_hash" = $1', [marker], new Error(marker));
  const { source, row, attempts } = await loginFixture({ updateError });
  const logged: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  let user;
  try {
    user = await source.verifyCredentials({ email: row.email, password: OLD_PASSWORD });
  } finally {
    console.error = original;
  }
  assert.equal(user?.id, 9);
  assert.equal(row.senhaHash, sha256(OLD_PASSWORD));
  assert.deepEqual(attempts, ["SUCESSO"]);
  assert.equal(logged.length, 1);
  assert.ok(!inspect(logged, { depth: Infinity }).includes(marker));
});
