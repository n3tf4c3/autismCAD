const assert = require("node:assert/strict");
const { test } = require("node:test");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const queryString = require("query-string");

test("#154 adaptador CJS mantem contratos usados pelo Expo Router", () => {
  assert.deepEqual({ ...queryString.parse("nome=Jo%C3%A3o&item=a&item=b&vazio=&flag") }, { flag: null, item: ["a", "b"], nome: "João", vazio: "" });
  assert.deepEqual(queryString.parseUrl("app://route?x=1&x=2"), { url: "app://route", query: Object.assign(Object.create(null), { x: ["1", "2"] }) });
  assert.equal(queryString.stringify({ nome: "João", a: ["1", "2"] }), "a=1&a=2&nome=Jo%C3%A3o");
  for (const malformed of ["%", "%A", "%ZZ", "%E0%A4%A", "%FF%FE"]) assert.equal(typeof queryString.parse(`x=${malformed}`).x, "string");
});

test("#154 entrada malformada extensa termina em processo limitado", async () => {
  const { stdout } = await promisify(execFile)(process.execPath, ["-e", "const q=require('query-string');const t=performance.now();q.parse('x='+('%EA'.repeat(1536)));console.log(performance.now()-t)"], { cwd: __dirname, timeout: 5000 });
  assert.ok(Number(stdout.trim()) < 1000, stdout);
});
