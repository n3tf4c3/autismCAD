import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { sanitizeAnamnesePayload } from "@/lib/anamnese/sanitize-anamnese-payload";
import { runDbTransaction } from "@/server/db/transaction";
import { anamnese, anamneseVersions, pacientes } from "@/server/db/schema";
import { AppError } from "@/server/shared/errors";
import { isUniqueViolation } from "@/server/shared/pg-errors";

type AnyRecord = Record<string, unknown>;

const anamneseReadAliases = {
  entrevista_por: "entrevistaPor",
  data_entrevista: "dataEntrevista",
  possui_diagnostico: "possuiDiagnostico",
  laudo_diagnostico: "laudoDiagnostico",
  medico_acompanhante: "medicoAcompanhante",
  fez_terapia: "fezTerapia",
  marcos_motores: "marcosMotores",
  periodo_escolar: "periodoEscolar",
  acompanhante_escolar: "acompanhanteEscolar",
  observacoes_escolares: "observacoesEscolares",
  seletividade_alimentar: "seletividadeAlimentar",
  rotina_sono: "rotinaSono",
  medicamentos_uso_anterior: "medicamentosUsoAnterior",
  medicamentos_uso_atual: "medicamentosUsoAtual",
  dificuldades_familia: "dificuldadesFamilia",
  expectativas_terapia: "expectativasTerapia",
} as const;

function normalizeAnamneseReadPayload(input: unknown): AnyRecord {
  const source =
    input && typeof input === "object" && !Array.isArray(input)
      ? ({ ...(input as AnyRecord) } as AnyRecord)
      : {};

  const normalized: AnyRecord = { ...source };
  for (const [snakeKey, camelKey] of Object.entries(anamneseReadAliases)) {
    if (normalized[camelKey] === undefined && source[snakeKey] !== undefined) {
      normalized[camelKey] = source[snakeKey];
    }
    if (snakeKey in normalized) {
      delete normalized[snakeKey];
    }
  }
  return sanitizeAnamnesePayload(normalized).payload;
}

function asTrimmedOrNull(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const parsed = String(value).trim();
  return parsed ? parsed : null;
}

function asDateOnlyOrNull(value: unknown): string | null {
  const raw = asTrimmedOrNull(value);
  if (!raw) return null;
  // Accept ISO strings and "YYYY-MM-DD". Normalize to date-only for <input type="date"> compat.
  const dateOnly = raw.length >= 10 ? raw.slice(0, 10) : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
  return dateOnly;
}
function asBoolOrNull(value: unknown): boolean | null {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "sim", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "nao", "no", "off"].includes(normalized)) return false;
  return null;
}

export function buildAnamnesePayload(pacienteId: number, body: AnyRecord) {
  const payload: AnyRecord = {};

  payload.entrevistaPor = asTrimmedOrNull(body.entrevistaPor);
  payload.dataEntrevista = asDateOnlyOrNull(body.dataEntrevista);
  payload.possuiDiagnostico = asBoolOrNull(body.possuiDiagnostico);
  payload.diagnostico = asTrimmedOrNull(body.diagnostico);
  payload.laudoDiagnostico = asTrimmedOrNull(body.laudoDiagnostico);
  payload.medicoAcompanhante = asTrimmedOrNull(body.medicoAcompanhante);
  payload.fezTerapia = asBoolOrNull(body.fezTerapia);
  payload.terapias = asTrimmedOrNull(body.terapias);
  payload.frequencia = asTrimmedOrNull(body.frequencia);
  payload.marcosMotores = asTrimmedOrNull(body.marcosMotores);
  payload.linguagem = asTrimmedOrNull(body.linguagem);
  payload.comunicacao = asTrimmedOrNull(body.comunicacao);
  payload.escola = asTrimmedOrNull(body.escola);
  payload.serie = asTrimmedOrNull(body.serie);
  payload.periodoEscolar = asTrimmedOrNull(body.periodoEscolar);
  payload.acompanhanteEscolar = asBoolOrNull(body.acompanhanteEscolar);
  payload.observacoesEscolares = asTrimmedOrNull(body.observacoesEscolares);
  payload.encaminhamento = asTrimmedOrNull(body.encaminhamento);
  payload.frustracoes = asTrimmedOrNull(body.frustracoes);
  payload.humor = asTrimmedOrNull(body.humor);
  payload.estereotipias = asTrimmedOrNull(body.estereotipias);
  payload.autoagressao = asTrimmedOrNull(body.autoagressao);
  payload.heteroagressao = asTrimmedOrNull(body.heteroagressao);
  payload.seletividadeAlimentar = asTrimmedOrNull(body.seletividadeAlimentar);
  payload.rotinaSono = asTrimmedOrNull(body.rotinaSono);
  payload.medicamentosUsoAnterior = asTrimmedOrNull(body.medicamentosUsoAnterior);
  payload.medicamentosUsoAtual = asTrimmedOrNull(body.medicamentosUsoAtual);
  payload.dificuldadesFamilia = asTrimmedOrNull(body.dificuldadesFamilia);
  payload.expectativasTerapia = asTrimmedOrNull(body.expectativasTerapia);

  return sanitizeAnamnesePayload(payload).payload;
}

export async function assertPacienteExists(pacienteId: number) {
  const [row] = await db
    .select({ id: pacientes.id })
    .from(pacientes)
    .where(and(eq(pacientes.id, pacienteId), isNull(pacientes.deletedAt)))
    .limit(1);
  if (!row) {
    throw new AppError("Paciente nao encontrado", 404, "NOT_FOUND");
  }
}

export async function obterAnamneseBase(pacienteId: number) {
  const [row] = await db
    .select({
      pacienteId: anamnese.pacienteId,
      payload: anamnese.payload,
      createdAt: anamnese.createdAt,
      updatedAt: anamnese.updatedAt,
    })
    .from(anamnese)
    .where(eq(anamnese.pacienteId, pacienteId))
    .limit(1);
  if (!row) return null;
  return {
    ...normalizeAnamneseReadPayload(row.payload),
    pacienteId: row.pacienteId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function obterAnamneseVersao(pacienteId: number, version?: number | null) {
  const rows = await db
    .select({
      pacienteId: anamneseVersions.pacienteId,
      version: anamneseVersions.version,
      status: anamneseVersions.status,
      payload: anamneseVersions.payload,
      createdAt: anamneseVersions.createdAt,
    })
    .from(anamneseVersions)
    .where(
      version
        ? and(eq(anamneseVersions.pacienteId, pacienteId), eq(anamneseVersions.version, version))
        : eq(anamneseVersions.pacienteId, pacienteId)
    )
    .orderBy(desc(anamneseVersions.version))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    ...normalizeAnamneseReadPayload(row.payload),
    version: row.version,
    status: row.status,
    createdAt: row.createdAt,
    pacienteId: row.pacienteId,
  };
}

export async function listarAnamneseVersoes(pacienteId: number, limit = 50) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const rows = await db
    .select({
      id: anamneseVersions.id,
      pacienteId: anamneseVersions.pacienteId,
      version: anamneseVersions.version,
      status: anamneseVersions.status,
      payload: anamneseVersions.payload,
      createdAt: anamneseVersions.createdAt,
    })
    .from(anamneseVersions)
    .where(eq(anamneseVersions.pacienteId, pacienteId))
    .orderBy(desc(anamneseVersions.version))
    .limit(safeLimit);

  return rows.map((row) => ({
    id: row.id,
    pacienteId: row.pacienteId,
    version: row.version,
    status: row.status,
    createdAt: row.createdAt,
    payload: normalizeAnamneseReadPayload(row.payload),
  }));
}

export async function salvarAnamneseCompleta(params: {
  pacienteId: number;
  body: AnyRecord;
  status?: string | null;
}) {
  const pacienteId = params.pacienteId;
  await assertPacienteExists(pacienteId);

  const status = params.status === "Finalizada" ? "Finalizada" : "Rascunho";
  const basePayload = buildAnamnesePayload(pacienteId, params.body);

  // Unique constraint on (paciente_id, version) + retry protects against rare races.
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await runDbTransaction(async (tx) => {
        await tx
          .insert(anamnese)
          .values({
            pacienteId,
            payload: basePayload,
          })
          .onConflictDoUpdate({
            target: anamnese.pacienteId,
            set: { payload: basePayload, updatedAt: sql`now()` },
          });

        const [last] = await tx
          .select({ lastVersion: sql<number>`coalesce(max(${anamneseVersions.version}), 0)` })
          .from(anamneseVersions)
          .where(eq(anamneseVersions.pacienteId, pacienteId));
        const nextVersion = Number(last?.lastVersion || 0) + 1;

        const versionPayload: AnyRecord = {
          ...basePayload,
          pacienteId,
        };

        const [savedVersion] = await tx
          .insert(anamneseVersions)
          .values({
            pacienteId,
            version: nextVersion,
            status,
            payload: versionPayload,
          })
          .returning({
            version: anamneseVersions.version,
            status: anamneseVersions.status,
            createdAt: anamneseVersions.createdAt,
          });

        return {
          ...versionPayload,
          version: savedVersion.version,
          status: savedVersion.status,
          createdAt: savedVersion.createdAt,
          pacienteId,
        };
      }, { operation: "anamnese.salvarAnamneseCompleta", mode: "required" });
    } catch (error) {
      // Unique violation -> retry.
      const message = (error as Error)?.message || "";
      if (
        attempt < maxRetries &&
        (isUniqueViolation(error) ||
          message.includes("uk_anamnese_versions_paciente_version"))
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new AppError("Erro ao salvar anamnese", 500, "INTERNAL_ERROR");
}

export async function excluirAnamneseCompleta(pacienteId: number) {
  await assertPacienteExists(pacienteId);

  return runDbTransaction(async (tx) => {
    const deletedVersions = await tx
      .delete(anamneseVersions)
      .where(eq(anamneseVersions.pacienteId, pacienteId))
      .returning({ id: anamneseVersions.id });

    const deletedBase = await tx
      .delete(anamnese)
      .where(eq(anamnese.pacienteId, pacienteId))
      .returning({ id: anamnese.id });

    if (!deletedVersions.length && !deletedBase.length) {
      throw new AppError("Anamnese nao encontrada", 404, "NOT_FOUND");
    }

    return {
      pacienteId,
      deleted: true,
      versions_deleted: deletedVersions.length,
    };
  }, { operation: "anamnese.excluirAnamneseCompleta", mode: "required" });
}

export async function excluirAnamneseVersao(pacienteId: number, version: number) {
  await assertPacienteExists(pacienteId);

  return runDbTransaction(async (tx) => {
    const deletedRows = await tx
      .delete(anamneseVersions)
      .where(
        and(
          eq(anamneseVersions.pacienteId, pacienteId),
          eq(anamneseVersions.version, version)
        )
      )
      .returning({ id: anamneseVersions.id });

    if (!deletedRows.length) {
      throw new AppError("Versao da anamnese nao encontrada", 404, "NOT_FOUND");
    }

    const [latestRemaining] = await tx
      .select({
        version: anamneseVersions.version,
        payload: anamneseVersions.payload,
      })
      .from(anamneseVersions)
      .where(eq(anamneseVersions.pacienteId, pacienteId))
      .orderBy(desc(anamneseVersions.version))
      .limit(1);

    if (latestRemaining) {
      await tx
        .insert(anamnese)
        .values({
          pacienteId,
          payload: latestRemaining.payload as AnyRecord,
        })
        .onConflictDoUpdate({
          target: anamnese.pacienteId,
          set: {
            payload: latestRemaining.payload as AnyRecord,
            updatedAt: sql`now()`,
          },
        });
    } else {
      await tx.delete(anamnese).where(eq(anamnese.pacienteId, pacienteId));
    }

    return {
      pacienteId,
      version,
      deleted: true,
      has_current: !!latestRemaining,
    };
  }, { operation: "anamnese.excluirAnamneseVersao", mode: "required" });
}

