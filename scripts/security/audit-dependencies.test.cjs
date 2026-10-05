const assert = require("node:assert/strict");
const { test } = require("node:test");
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { hash, verifyPatches, assessAudit } = require("./audit-dependencies.cjs");

const advisory = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
const entry = { package: "braces", version: "3.0.3", nodes: ["node_modules/braces"], advisory, files: { "lib/compile.js": hash("patched\n") }, patch: "patches/braces.patch", patchHash: hash("patch\n") };
const leaf = { name: "braces", severity: "high", nodes: entry.nodes, via: [{ name: "braces", url: advisory, severity: "high" }] };
function report(vulnerabilities) {
  return { auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: {
    high: Object.values(vulnerabilities).filter((item) => item.severity === "high").length,
    critical: Object.values(vulnerabilities).filter((item) => item.severity === "critical").length
  } } };
}
const verified = new Map([[advisory, entry]]);

test("audit covers only exact patched advisories and their transitive chains", () => {
  const parent = { severity: "high", via: ["braces"], nodes: ["node_modules/micromatch"] };
  assert.deepEqual(assessAudit(report({ braces: leaf, micromatch: parent }), verified).blocked, []);
  assert.equal(assessAudit(report({ braces: leaf, micromatch: parent }), verified).patched, 2);
  assert.deepEqual(assessAudit(report({}), verified).blocked, []);
  const cycle = { a: { severity: "high", nodes: [], via: ["b"] }, b: { severity: "high", nodes: [], via: ["a", "braces"] }, braces: leaf };
  assert.deepEqual(assessAudit(report(cycle), verified).blocked, []);
});

test("audit blocks new advisories, critical severity, copies and mixed parent chains", () => {
  for (const changed of [
    { ...leaf, via: [...leaf.via, { name: "braces", url: "https://github.com/advisories/GHSA-new", severity: "high" }] },
    { ...leaf, severity: "critical" },
    { ...leaf, nodes: [...leaf.nodes, "node_modules/other/node_modules/braces"] },
    { ...leaf, via: [] }
  ]) assert.deepEqual(assessAudit(report({ braces: changed }), verified).blocked, ["braces"]);
  const unknown = { severity: "high", nodes: ["node_modules/unknown"], via: [{ name: "unknown", url: "unknown", severity: "high" }] };
  const mixed = { severity: "high", nodes: ["node_modules/mixed"], via: ["braces", "unknown"] };
  assert.deepEqual(assessAudit(report({ braces: leaf, unknown, mixed }), verified).blocked, ["unknown", "mixed"]);
});

test("audit fails closed for missing chains, cycles, errors and inconsistent reports", () => {
  assert.deepEqual(assessAudit(report({ a: { severity: "high", nodes: [], via: ["missing"] } }), verified).blocked, ["a"]);
  assert.deepEqual(assessAudit(report({ a: { severity: "high", nodes: [], via: ["b"] }, b: { severity: "high", nodes: [], via: ["a"] } }), verified).blocked, ["a", "b"]);
  for (const invalid of [{}, { ...report({}), error: { code: "network" } }, { ...report({}), metadata: { vulnerabilities: { high: 1, critical: 0 } } }]) {
    assert.throws(() => assessAudit(invalid, verified), /Invalid|Inconsistent/);
  }
});

test("patch integrity verifies installed code, package versions, lock coverage and patch source", (context) => {
  const directory = mkdtempSync(path.join(tmpdir(), "autismcad-security-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const put = (file, text) => { mkdirSync(path.dirname(path.join(directory, file)), { recursive: true }); writeFileSync(path.join(directory, file), text); };
  const lock = { packages: { "node_modules/braces": { version: "3.0.3" } } };
  put("package-lock.json", JSON.stringify(lock));
  put("node_modules/braces/package.json", JSON.stringify({ name: "braces", version: "3.0.3" }));
  put("node_modules/braces/lib/compile.js", "patched\r\n");
  put("patches/braces.patch", "patch\n");
  assert.equal(verifyPatches(directory, [entry]).size, 1);
  put("node_modules/braces/lib/compile.js", "unpatched\n");
  assert.throws(() => verifyPatches(directory, [entry]), /integrity/);
  put("node_modules/braces/lib/compile.js", "patched\n");
  put("patches/braces.patch", "different patch\n");
  assert.throws(() => verifyPatches(directory, [entry]), /integrity/);
  put("patches/braces.patch", "patch\n");
  put("node_modules/braces/package.json", JSON.stringify({ name: "braces", version: "3.0.4" }));
  assert.throws(() => verifyPatches(directory, [entry]), /Version/);
  put("node_modules/braces/package.json", JSON.stringify({ name: "braces", version: "3.0.3" }));
  lock.packages["node_modules/other/node_modules/braces"] = { version: "3.0.3" };
  put("package-lock.json", JSON.stringify(lock));
  assert.throws(() => verifyPatches(directory, [entry]), /Copies/);
});
