import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_LOGIN_RATE_LIMIT,
  exceedsLoginRateLimit,
} from "@/lib/auth/login-rate-limit";

// Achado 60: criterio de lockout por janela deslizante (limites por e-mail e por IP).

test("nao bloqueia abaixo dos limites", () => {
  assert.equal(
    exceedsLoginRateLimit({ emailFailures: 3, ipFailures: 10, hasIp: true }),
    false
  );
});

test("bloqueia ao atingir o limite por e-mail", () => {
  assert.equal(
    exceedsLoginRateLimit({
      emailFailures: DEFAULT_LOGIN_RATE_LIMIT.maxFailuresPerEmail,
      ipFailures: 0,
      hasIp: true,
    }),
    true
  );
});

test("bloqueia ao atingir o limite por IP", () => {
  assert.equal(
    exceedsLoginRateLimit({
      emailFailures: 0,
      ipFailures: DEFAULT_LOGIN_RATE_LIMIT.maxFailuresPerIp,
      hasIp: true,
    }),
    true
  );
});

test("ignora limite por IP quando o IP e desconhecido", () => {
  assert.equal(
    exceedsLoginRateLimit({
      emailFailures: 0,
      ipFailures: DEFAULT_LOGIN_RATE_LIMIT.maxFailuresPerIp + 50,
      hasIp: false,
    }),
    false
  );
});
