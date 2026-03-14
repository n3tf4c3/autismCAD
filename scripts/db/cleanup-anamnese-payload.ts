import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { anamnese, anamneseVersions } from "../../src/server/db/schema";
import { sanitizeAnamnesePayload } from "../../src/lib/anamnese/sanitize-anamnese-payload";

config({ path: ".env.local" });
config({ path: ".env" });

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value || !value.trim()) return undefined;
  return value.trim();
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main() {
  const databaseUrl = readEnv("DATABASE_URL");
  if (!databaseUrl) throw new Error("DATABASE_URL nao configurado.");

  const apply = hasFlag("--apply");
  const sql = neon(databaseUrl);
  const db = drizzle({ client: sql });

  const [baseRows, versionRows] = await Promise.all([
    db.select({ id: anamnese.id, payload: anamnese.payload }).from(anamnese),
    db.select({ id: anamneseVersions.id, payload: anamneseVersions.payload }).from(anamneseVersions),
  ]);

  let changedBase = 0;
  let changedVersions = 0;
  const sampleBaseIds: number[] = [];
  const sampleVersionIds: number[] = [];

  for (const row of baseRows) {
    const sanitized = sanitizeAnamnesePayload(row.payload);
    if (!sanitized.changed) continue;

    changedBase += 1;
    if (sampleBaseIds.length < 20) sampleBaseIds.push(Number(row.id));

    if (!apply) continue;

    await db
      .update(anamnese)
      .set({
        payload: sanitized.payload,
        updatedAt: new Date(),
      })
      .where(eq(anamnese.id, row.id));
  }

  for (const row of versionRows) {
    const sanitized = sanitizeAnamnesePayload(row.payload);
    if (!sanitized.changed) continue;

    changedVersions += 1;
    if (sampleVersionIds.length < 20) sampleVersionIds.push(Number(row.id));

    if (!apply) continue;

    await db
      .update(anamneseVersions)
      .set({
        payload: sanitized.payload,
      })
      .where(eq(anamneseVersions.id, row.id));
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        scanned: {
          anamnese: baseRows.length,
          versions: versionRows.length,
        },
        changed: {
          anamnese: changedBase,
          versions: changedVersions,
        },
        sampleIds: {
          anamnese: sampleBaseIds,
          versions: sampleVersionIds,
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
