import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

function source(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

test("API_V1_CORS_ORIGIN pertence ao contrato central e ao cache de build", () => {
  const envSource = source("apps/web/src/lib/env.ts");
  const proxySource = source("apps/web/src/proxy.ts");
  const envExample = source("apps/web/.env.example");
  const turbo = JSON.parse(source("turbo.json")) as { globalEnv?: string[] };

  assert.match(envSource, /API_V1_CORS_ORIGIN:\s*z\.string\(\)\.url\(\)\.optional\(\)/);
  assert.match(proxySource, /configured:\s*env\.API_V1_CORS_ORIGIN/);
  assert.match(envExample, /^API_V1_CORS_ORIGIN=/m);
  assert.ok(turbo.globalEnv?.includes("API_V1_CORS_ORIGIN"));
});

test("CI, Node, npm e EAS usam contratos reproduziveis", () => {
  const workflow = source(".github/workflows/ci.yml");
  const packageJson = JSON.parse(source("package.json")) as {
    packageManager?: string;
    engines?: { node?: string; npm?: string };
  };
  const eas = JSON.parse(source("apps/mobile/eas.json")) as { cli?: { version?: string } };

  assert.match(workflow, /runs-on:\s*ubuntu-24\.04/);
  assert.match(workflow, /actions\/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8/);
  assert.match(workflow, /actions\/setup-node@a0853c24544627f65ddf259abe73b1d18a591444/);
  assert.match(workflow, /node-version:\s*"22\.22\.0"/);
  assert.match(workflow, /npm install --global npm@11\.7\.0/);
  assert.equal(packageJson.packageManager, "npm@11.7.0");
  assert.equal(packageJson.engines?.node, "^22.22.0 || ^24.11.0");
  assert.equal(packageJson.engines?.npm, "11.7.0");
  assert.equal(eas.cli?.version, "22.2.0");
});
