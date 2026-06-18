import assert from "node:assert/strict";
import { test } from "node:test";

import { isCalendarDate, isValidTimeOfDay } from "@autismcad/validators/common/datetime";

// Achado 76: horario precisa de faixa real, nao so formato.
test("isValidTimeOfDay aceita horarios validos", () => {
  assert.equal(isValidTimeOfDay("00:00"), true);
  assert.equal(isValidTimeOfDay("23:59"), true);
  assert.equal(isValidTimeOfDay("08:30:15"), true);
});

test("isValidTimeOfDay rejeita fora da faixa e formato invalido", () => {
  assert.equal(isValidTimeOfDay("99:99"), false);
  assert.equal(isValidTimeOfDay("24:00"), false);
  assert.equal(isValidTimeOfDay("12:60"), false);
  assert.equal(isValidTimeOfDay("9:00"), false);
});

// Achado 88/101: data-only precisa ser calendario real.
test("isCalendarDate aceita datas reais", () => {
  assert.equal(isCalendarDate("2026-06-17"), true);
  assert.equal(isCalendarDate("2024-02-29"), true); // bissexto
});

test("isCalendarDate rejeita datas inexistentes e formato invalido", () => {
  assert.equal(isCalendarDate("2026-02-31"), false);
  assert.equal(isCalendarDate("2026-13-01"), false);
  assert.equal(isCalendarDate("2026-00-10"), false);
  assert.equal(isCalendarDate("2025-02-29"), false); // nao bissexto
  assert.equal(isCalendarDate("17/06/2026"), false);
});
