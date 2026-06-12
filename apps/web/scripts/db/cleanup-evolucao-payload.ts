import { config } from "dotenv";
import { eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { evolucoes } from "../../src/server/db/schema";
import { sanitizeEvolucaoPayload } from "../../src/lib/prontuario/evolucao-payload";

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

  const rows = await db
    .select({
      id: evolucoes.id,
      payload: evolucoes.payload,
    })
    .from(evolucoes)
    .where(isNull(evolucoes.deletedAt));

  let changedCount = 0;
  let metasAdjusted = 0;
  const changedIds: number[] = [];

  for (const row of rows) {
    const originalPayload = (row.payload ?? {}) as Record<string, unknown>;
    const originalMetas = JSON.stringify(originalPayload.metas ?? null);
    const sanitized = sanitizeEvolucaoPayload(originalPayload);
    if (!sanitized.changed) continue;

    changedCount += 1;
    if (JSON.stringify(sanitized.payload.metas ?? null) !== originalMetas) metasAdjusted += 1;
    if (changedIds.length < 20) changedIds.push(Number(row.id));

    if (!apply) continue;

    await db
      .update(evolucoes)
      .set({
        payload: sanitized.payload,
        updatedAt: new Date(),
      })
      .where(eq(evolucoes.id, row.id));
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        scanned: rows.length,
        changed: changedCount,
        metasAdjusted,
        sampleIds: changedIds,
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
