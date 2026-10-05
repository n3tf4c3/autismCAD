const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const hash = (text) => createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");

function verifyPatches(directory, policy) {
  const lock = JSON.parse(readFileSync(path.join(directory, "package-lock.json"), "utf8"));
  const verified = new Map();
  for (const entry of policy) {
    const installedPaths = Object.keys(lock.packages).filter((key) => key.endsWith(`/node_modules/${entry.package}`) || key === `node_modules/${entry.package}`).sort();
    if (JSON.stringify(installedPaths) !== JSON.stringify([...entry.nodes].sort())) {
      throw new Error(`Copies of ${entry.package} changed; review the patch coverage`);
    }
    for (const node of entry.nodes) {
      const installed = JSON.parse(readFileSync(path.join(directory, node, "package.json"), "utf8"));
      if (installed.name !== entry.package || installed.version !== entry.version || lock.packages[node].version !== entry.version) {
        throw new Error(`Version of ${entry.package} changed; review the patch`);
      }
      for (const [file, expected] of Object.entries(entry.files)) {
        if (hash(readFileSync(path.join(directory, node, file), "utf8")) !== expected) {
          throw new Error(`Patch integrity failed: ${node}/${file}`);
        }
      }
    }
    if (hash(readFileSync(path.join(directory, entry.patch), "utf8")) !== entry.patchHash) {
      throw new Error(`Patch integrity failed: ${entry.patch}`);
    }
    verified.set(entry.advisory, entry);
  }
  return verified;
}

function assessAudit(report, verified) {
  if (report.auditReportVersion !== 2 || !report.vulnerabilities || !report.metadata?.vulnerabilities || report.error) {
    throw new Error("Invalid npm audit response; security check cannot proceed");
  }
  const vulnerabilities = report.vulnerabilities;
  function covered(name) {
    const pending = [name], visited = new Set();
    let patchedLeaf = false;
    while (pending.length) {
      const current = pending.pop();
      if (visited.has(current)) continue;
      visited.add(current);
      const item = vulnerabilities[current];
      if (!item || item.severity === "critical" || !Array.isArray(item.via) || item.via.length === 0 || !Array.isArray(item.nodes)) return false;
      for (const via of item.via) {
        if (typeof via === "string") { pending.push(via); continue; }
        const patch = verified.get(via?.url);
        if (!patch || via.name !== patch.package || current !== patch.package || via.severity !== "high" ||
          item.nodes.length !== patch.nodes.length || !item.nodes.every((node) => patch.nodes.includes(node))) return false;
        patchedLeaf = true;
      }
    }
    // npm can report parent cycles (Expo/Metro); every reachable advisory must be patched.
    return patchedLeaf;
  }
  const relevant = Object.entries(vulnerabilities).filter(([, item]) => ["high", "critical"].includes(item.severity));
  for (const severity of ["high", "critical"]) {
    if (report.metadata.vulnerabilities[severity] !== relevant.filter(([, item]) => item.severity === severity).length) {
      throw new Error("Inconsistent npm audit severity counts");
    }
  }
  const blocked = relevant.filter(([name]) => !covered(name)).map(([name]) => name);
  return { counts: report.metadata.vulnerabilities, patched: relevant.length - blocked.length, blocked };
}

function main() {
  const policy = JSON.parse(readFileSync(path.join(__dirname, "patched-advisories.json"), "utf8"));
  const verified = verifyPatches(root, policy);
  // Real exploit regressions must pass before the advisory can be treated as patched.
  const tests = spawnSync(process.execPath, ["--test", path.join(__dirname, "dependency-patches.test.cjs")], { cwd: root, stdio: "inherit", timeout: 30000 });
  if (tests.error || tests.status !== 0) throw new Error("Dependency security regressions failed");
  if (!process.env.npm_execpath) throw new Error("Run with npm run audit:dependencies");
  const audit = spawnSync(process.execPath, [process.env.npm_execpath, "audit", "--json"], { cwd: root, encoding: "utf8", timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  if (audit.error || ![0, 1].includes(audit.status)) throw new Error(audit.error?.message || audit.stderr || "npm audit failed");
  const result = assessAudit(JSON.parse(audit.stdout), verified);
  console.log("npm audit (including dev):", JSON.stringify(result.counts));
  console.log(`High/critical dependency entries covered by verified local patches: ${result.patched}`);
  if (result.blocked.length) throw new Error(`Unmitigated advisories: ${result.blocked.join(", ")}`);
  console.log("No unmitigated high or critical advisories. Raw npm audit still reports unpublished fixes.");
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { hash, verifyPatches, assessAudit };
