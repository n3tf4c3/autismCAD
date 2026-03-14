import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { sanitizeAnamnesePayload } from "@/lib/anamnese/sanitize-anamnese-payload";
import { runDbTransaction } from "@/server/db/transaction";
import { anamnese, anamneseVersions, pacientes } from "@/server/db/schema";
import { AppError } from "@/server/shared/errors";
import { isUniqueViolation } from "@/server/shared/pg-errors";

type AnyRecord = Record<string, unknown>;

function readValue(body: AnyRecord, camel: string, snake: string) {
  if (body[camel] !== undefined) return body[camel];
  if (body[snake] !== undefined) return body[snake];
  return undefined;
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
  if (["0", "false", "nao", "não", "nÃ£o", "no", "off"].includes(normalized)) return false;
  return null;
}

export function buildAnamnesePayload(pacienteId: number, body: AnyRecord) {
  const payload: AnyRecord = {};

  payload.entrevistaPor = asTrimmedOrNull(readValue(body, "entrevistaPor", "entrevista_por"));
  payload.dataEntrevista = asDateOnlyOrNull(readValue(body, "dataEntrevista", "data_entrevista"));
  payload.possuiDiagnostico = asBoolOrNull(readValue(body, "possuiDiagnostico", "possui_diagnostico"));
  payload.diagnostico = asTrimmedOrNull(readValue(body, "diagnostico", "diagnostico"));
  payload.laudoDiagnostico = asTrimmedOrNull(readValue(body, "laudoDiagnostico", "laudo_diagnostico"));
  payload.medicoAcompanhante = asTrimmedOrNull(readValue(body, "medicoAcompanhante", "medico_acompanhante"));
  payload.fezTerapia = asBoolOrNull(readValue(body, "fezTerapia", "fez_terapia"));
  payload.terapias = asTrimmedOrNull(readValue(body, "terapias", "terapias"));
  payload.frequencia = asTrimmedOrNull(readValue(body, "frequencia", "frequencia"));
  payload.marcosMotores = asTrimmedOrNull(readValue(body, "marcosMotores", "marcos_motores"));
  payload.linguagem = asTrimmedOrNull(readValue(body, "linguagem", "linguagem"));
  payload.comunicacao = asTrimmedOrNull(readValue(body, "comunicacao", "comunicacao"));
  payload.escola = asTrimmedOrNull(readValue(body, "escola", "escola"));
  payload.serie = asTrimmedOrNull(readValue(body, "serie", "serie"));
  payload.acompanhanteEscolar = asBoolOrNull(readValue(body, "acompanhanteEscolar", "acompanhante_escolar"));
  payload.observacoesEscolares = asTrimmedOrNull(readValue(body, "observacoesEscolares", "observacoes_escolares"));
  payload.encaminhamento = asTrimmedOrNull(readValue(body, "encaminhamento", "encaminhamento"));
  payload.frustracoes = asTrimmedOrNull(readValue(body, "frustracoes", "frustracoes"));
  payload.humor = asTrimmedOrNull(readValue(body, "humor", "humor"));
  payload.estereotipias = asTrimmedOrNull(readValue(body, "estereotipias", "estereotipias"));
  payload.autoagressao = asTrimmedOrNull(readValue(body, "autoagressao", "autoagressao"));
  payload.heteroagressao = asTrimmedOrNull(readValue(body, "heteroagressao", "heteroagressao"));
  payload.seletividadeAlimentar = asTrimmedOrNull(readValue(body, "seletividadeAlimentar", "seletividade_alimentar"));
  payload.rotinaSono = asTrimmedOrNull(readValue(body, "rotinaSono", "rotina_sono"));
  payload.medicamentosUsoAnterior = asTrimmedOrNull(readValue(body, "medicamentosUsoAnterior", "medicamentos_uso_anterior"));
  payload.medicamentosUsoAtual = asTrimmedOrNull(readValue(body, "medicamentosUsoAtual", "medicamentos_uso_atual"));
  payload.dificuldadesFamilia = asTrimmedOrNull(readValue(body, "dificuldadesFamilia", "dificuldades_familia"));
  payload.expectativasTerapia = asTrimmedOrNull(readValue(body, "expectativasTerapia", "expectativas_terapia"));

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
      created_at: anamnese.createdAt,
      updated_at: anamnese.updatedAt,
    })
    .from(anamnese)
    .where(eq(anamnese.pacienteId, pacienteId))
    .limit(1);
  if (!row) return null;
  return {
    ...(row.payload as AnyRecord),
    paciente_id: row.pacienteId,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function obterAnamneseVersao(pacienteId: number, version?: number | null) {
  const rows = await db
    .select({
      pacienteId: anamneseVersions.pacienteId,
      version: anamneseVersions.version,
      status: anamneseVersions.status,
      payload: anamneseVersions.payload,
      created_at: anamneseVersions.createdAt,
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
    ...(row.payload as AnyRecord),
    version: row.version,
    status: row.status,
    created_at: row.created_at,
    paciente_id: row.pacienteId,
  };
}

export async function listarAnamneseVersoes(pacienteId: number, limit = 50) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const rows = await db
    .select({
      id: anamneseVersions.id,
      paciente_id: anamneseVersions.pacienteId,
      version: anamneseVersions.version,
      status: anamneseVersions.status,
      payload: anamneseVersions.payload,
      created_at: anamneseVersions.createdAt,
    })
    .from(anamneseVersions)
    .where(eq(anamneseVersions.pacienteId, pacienteId))
    .orderBy(desc(anamneseVersions.version))
    .limit(safeLimit);

  return rows.map((row) => ({
    id: row.id,
    paciente_id: row.paciente_id,
    version: row.version,
    status: row.status,
    created_at: row.created_at,
    payload: row.payload as AnyRecord,
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
          paciente_id: pacienteId,
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
            created_at: anamneseVersions.createdAt,
          });

        return {
          ...versionPayload,
          version: savedVersion.version,
          status: savedVersion.status,
          created_at: savedVersion.created_at,
          paciente_id: pacienteId,
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
      paciente_id: pacienteId,
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
      paciente_id: pacienteId,
      version,
      deleted: true,
      has_current: !!latestRemaining,
    };
  }, { operation: "anamnese.excluirAnamneseVersao", mode: "required" });
}
