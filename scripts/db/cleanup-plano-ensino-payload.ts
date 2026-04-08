import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { prontuarioDocumentos } from "../../src/server/db/schema";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeOptionalText(value: unknown): string | null {
  const parsed = String(value ?? "").trim();
  return parsed || null;
}

function normalizeDateOnlyLoose(value: unknown): string | null {
  const parsed = String(value ?? "").trim();
  if (!parsed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(parsed)) return parsed;
  const date = new Date(parsed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function sanitizePlanoEnsinoPayload(input: unknown): Record<string, unknown> {
  const rec = isRecord(input) ? input : {};
  const rawBlocos = Array.isArray(rec.blocos) ? rec.blocos : Array.isArray(rec.itens) ? rec.itens : [];
  const blocos = rawBlocos
    .map((value) => {
      if (!isRecord(value)) return null;
      const bloco = {
        habilidade: normalizeOptionalText(value.habilidade),
        ensino: normalizeOptionalText(value.ensino),
        objetivoEnsino: normalizeOptionalText(value.objetivoEnsino ?? value.objetivo_ensino),
        recursos: normalizeOptionalText(value.recursos),
        procedimento: normalizeOptionalText(value.procedimento),
        suportes: normalizeOptionalText(value.suportes),
        alvo: normalizeOptionalText(value.alvo ?? value.target),
        objetivoEspecifico: normalizeOptionalText(value.objetivoEspecifico ?? value.objetivo_especifico),
        criterioSucesso: normalizeOptionalText(value.criterioSucesso ?? value.criterio_sucesso),
      };
      if (!Object.values(bloco).some(Boolean)) return null;
      return bloco;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    especialidade: normalizeOptionalText(rec.especialidade),
    dataInicio: normalizeDateOnlyLoose(rec.dataInicio ?? rec.data_inicio),
    dataFinal: normalizeDateOnlyLoose(rec.dataFinal ?? rec.data_final),
    blocos,
  };
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
  const sql = neon(databaseUrl);
  const db = drizzle({ client: sql });

  const rows = await db
    .select({
      id: prontuarioDocumentos.id,
      payload: prontuarioDocumentos.payload,
    })
    .from(prontuarioDocumentos)
    .where(eq(prontuarioDocumentos.tipo, "PLANO_ENSINO"));

  let changedCount = 0;
  let typoRecords = 0;
  let renamedFields = 0;
  const sampleIds: number[] = [];

  for (const row of rows) {
    const originalPayload = row.payload ?? {};
    const legacy = normalizeLegacyPlanoEnsinoTypos(originalPayload);
    const sanitized = sanitizePlanoEnsinoPayload(legacy.payload);
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
