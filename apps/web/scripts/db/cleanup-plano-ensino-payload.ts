import "./_load-env";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { prontuarioDocumentos } from "@autismcad/db/schema";
import { sanitizePlanoEnsinoPayload } from "@autismcad/shared/plano-ensino";

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value || !value.trim()) return undefined;
  return value.trim();
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeLegacyPlanoEnsinoTypos(input: unknown): {
  payload: unknown;
  changed: boolean;
  renamedFields: number;
} {
  if (!isRecord(input)) {
    return { payload: input, changed: false, renamedFields: 0 };
  }

  let changed = false;
  let renamedFields = 0;
  const root: Record<string, unknown> = { ...input };

  const normalizeArrayField = (field: "blocos" | "itens") => {
    const source = root[field];
    if (!Array.isArray(source)) return;

    let fieldChanged = false;
    const mapped = source.map((entry) => {
      if (!isRecord(entry)) return entry;
      if (!Object.prototype.hasOwnProperty.call(entry, "rercusos")) return entry;

      const next = { ...entry };
      if (!Object.prototype.hasOwnProperty.call(next, "recursos")) {
        next.recursos = next.rercusos;
      }
      delete next.rercusos;
      fieldChanged = true;
      renamedFields += 1;
      return next;
    });

    if (fieldChanged) {
      root[field] = mapped;
      changed = true;
    }
  };

  normalizeArrayField("blocos");
  normalizeArrayField("itens");

  return { payload: root, changed, renamedFields };
}

async function main() {
  const databaseUrl = readEnv("DATABASE_URL");
  if (!databaseUrl) throw new Error("DATABASE_URL nao configurado.");

  const apply = hasFlag("--apply");
  // Achado 63: usar o mesmo timezone da aplicacao no saneamento de datas.
  const timeZone = readEnv("APP_TIMEZONE") ?? "America/Sao_Paulo";
  const sql = neon(databaseUrl);
  const db = drizzle({ client: sql });

  const rows = await db
    .select({
      id: prontuarioDocumentos.id,
      payload: prontuarioDocumentos.payload,
    })
    .from(prontuarioDocumentos)
    .where(
      and(
        eq(prontuarioDocumentos.tipo, "PLANO_ENSINO"),
        // Nao tocar historico excluido logicamente.
        isNull(prontuarioDocumentos.deletedAt)
      )
    );

  let changedCount = 0;
  let typoRecords = 0;
  let renamedFields = 0;
  const sampleIds: number[] = [];

  for (const row of rows) {
    const originalPayload = row.payload ?? {};
    const legacy = normalizeLegacyPlanoEnsinoTypos(originalPayload);
    const sanitized = sanitizePlanoEnsinoPayload(legacy.payload, timeZone);
    const changed = legacy.changed || JSON.stringify(originalPayload) !== JSON.stringify(sanitized);
    if (!changed) continue;

    changedCount += 1;
    if (legacy.changed) {
      typoRecords += 1;
      renamedFields += legacy.renamedFields;
    }
    if (sampleIds.length < 20) sampleIds.push(Number(row.id));

    if (!apply) continue;

    await db
      .update(prontuarioDocumentos)
      .set({
        payload: sanitized,
        updatedAt: new Date(),
      })
      .where(eq(prontuarioDocumentos.id, row.id));
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        scanned: rows.length,
        changed: changedCount,
        typoRecords,
        renamedFields,
        sampleIds,
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
