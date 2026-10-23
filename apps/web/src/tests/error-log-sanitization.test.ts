import assert from "node:assert/strict";
import { test } from "node:test";
import { inspect } from "node:util";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { describeErrorForLog, toAppError } from "@autismcad/shared/errors";

// Achado 158: o logger central nao pode copiar params/detail/mensagem de erros de banco
// (valores do payload clinico/pessoal) para os logs do host.

const MARKER = "MARCADOR-SINTETICO-158";

function driverError() {
  const cause = Object.assign(new Error(`duplicate key value: ${MARKER}`), {
    name: "NeonDbError",
    code: "23505",
    constraint: "uk_users_email_ativo",
    detail: `Key (email)=(${MARKER}@exemplo.invalid) already exists.`,
  });
  return new DrizzleQueryError(
    'insert into "evolucoes" ("payload") values ($1)',
    [{ observacao: MARKER }],
    cause
  );
}

function captureConsoleError(run: () => void): unknown[][] {
  const calls: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { calls.push(args); };
  try {
    run();
  } finally {
    console.error = original;
  }
  return calls;
}

test("toAppError registra o erro de banco sem params, detail nem mensagem", () => {
  let result: ReturnType<typeof toAppError> | undefined;
  const calls = captureConsoleError(() => {
    result = toAppError(driverError());
  });

  assert.equal(calls.length, 1);
  const logged = inspect(calls, { depth: Infinity });
  assert.ok(!logged.includes(MARKER), `log contem o marcador: ${logged}`);
  assert.equal(result?.message, "Erro interno");
  assert.equal(result?.code, "INTERNAL_ERROR");
});

test("entrada de log preserva metadados uteis para diagnostico", () => {
  const entry = describeErrorForLog(driverError());
  assert.deepEqual(entry.errorClass, ["DrizzleQueryError", "NeonDbError"]);
  assert.equal(entry.code, "23505");
  assert.equal(entry.constraint, "uk_users_email_ativo");
  assert.ok(entry.stack?.length, "stack sem frames");
  assert.ok(entry.stack.every((line) => line.startsWith("at ")));
  assert.ok(!inspect(entry, { depth: Infinity }).includes(MARKER));
});

test("valores fora do formato de metadado nao entram no log", () => {
  const entry = describeErrorForLog({ name: MARKER, code: `${MARKER} x`, constraint: `${MARKER} y` });
  assert.ok(!inspect(entry, { depth: Infinity }).includes(MARKER));
  assert.equal(entry.code, undefined);
  assert.equal(entry.constraint, undefined);
});
