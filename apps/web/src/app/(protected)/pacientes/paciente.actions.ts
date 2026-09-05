"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { pacientes } from "@autismcad/db/schema";
import { runDbTransaction } from "@/server/db/transaction";
import { patientFinalKey, patientUploadFilename } from "@/server/storage/patient-file-key";
import {
  pacientesQuerySchema,
  savePacienteSchema,
} from "@autismcad/validators/pacientes/pacientes.schema";
import {
  findPacienteByCpfAtivo,
  listarPacientes,
  listarPacientesPorUsuario,
  salvarPaciente,
  setPacienteAtivo,
  softDeletePaciente,
} from "@/server/modules/pacientes/pacientes.service";
import { AppError, toAppError } from "@/server/shared/errors";
import {
  ALLOWED_UPLOAD_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
  buildObjectKey,
  copyObjectInR2,
  createSignedReadUrl,
  createSignedWriteUrl,
  deleteObjectFromR2,
  headObjectMetadataInR2,
  isAllowedUploadContentType,
  normalizeUploadContentType,
} from "@/server/storage/r2";

type ActionError = {
  ok: false;
  error: string;
  code: string;
  status: number;
};

type ActionOk<T> = {
  ok: true;
  data: T;
};

export type ActionResult<T> = ActionOk<T> | ActionError;

function actionErrorResult(error: unknown): ActionError {
  const appError = toAppError(error);
  return {
    ok: false,
    error: appError.message,
    code: appError.code,
    status: appError.status,
  };
}

export async function salvarPacienteAction(
  input: unknown,
  pacienteId?: number | null
): Promise<ActionResult<{ id: number; reaproveitado: boolean }>> {
  try {
    const parsed = savePacienteSchema.parse(input);
    const idNum = pacienteId ? Number(pacienteId) : null;

    if (idNum && Number.isFinite(idNum) && idNum > 0) {
      const { user, access } = await requirePermission("pacientes:edit");
      await assertPacienteAccess(user, idNum, access);
      const savedId = await salvarPaciente(parsed, idNum);
      revalidatePath("/pacientes");
      revalidatePath(`/pacientes/${savedId}`);
      revalidatePath(`/pacientes/${savedId}/editar`);
      revalidatePath(`/prontuario/${savedId}`);
      return { ok: true, data: { id: savedId, reaproveitado: false } };
    }

    await requirePermission("pacientes:create");
    const existing = await findPacienteByCpfAtivo(parsed.cpf);
    if (existing) {
      throw new AppError(
        "Ja existe um paciente cadastrado com este CPF na plataforma.",
        409,
        "CPF_ALREADY_IN_USE"
      );
    }

    const savedId = await salvarPaciente(parsed, null);
    revalidatePath("/pacientes");
    revalidatePath(`/pacientes/${savedId}`);
    revalidatePath(`/pacientes/${savedId}/editar`);
    revalidatePath(`/prontuario/${savedId}`);
    return { ok: true, data: { id: savedId, reaproveitado: false } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function setPacienteAtivoAction(
  pacienteId: number,
  ativo: boolean
): Promise<ActionResult<{ id: number; ativo: boolean | number | string | null }>> {
  try {
    const { user, access } = await requirePermission("pacientes:edit");
    const idNum = Number(pacienteId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      throw new AppError("Paciente invalido", 400, "INVALID_INPUT");
    }
    await assertPacienteAccess(user, idNum, access);

    const result = await setPacienteAtivo(idNum, Boolean(ativo));
    revalidatePath("/pacientes");
    revalidatePath(`/pacientes/${idNum}`);
    revalidatePath(`/pacientes/${idNum}/editar`);
    revalidatePath(`/prontuario/${idNum}`);

    return { ok: true, data: { id: result.id, ativo: result.ativo } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function deletePacienteAction(
  pacienteId: number
): Promise<ActionResult<{ id: number }>> {
  try {
    const idNum = Number(pacienteId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      throw new AppError("Paciente invalido", 400, "INVALID_INPUT");
    }

    const { user, access } = await requirePermission("pacientes:delete");
    await assertPacienteAccess(user, idNum, access);
    const result = await softDeletePaciente(idNum, user.id);

    revalidatePath("/pacientes");
    revalidatePath(`/pacientes/${idNum}`);
    revalidatePath(`/prontuario/${idNum}`);

    return { ok: true, data: { id: result.id } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function listarPacientesAction(
  filters: unknown
): Promise<ActionResult<{ items: Awaited<ReturnType<typeof listarPacientes>> }>> {
  try {
    const { user } = await requirePermission("pacientes:view");
    const parsed = pacientesQuerySchema.parse(filters ?? {});
    const rows = await listarPacientesPorUsuario(user.id, parsed);
    return { ok: true, data: { items: rows } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

const arquivoKindSchema = z.enum(["foto", "laudo", "documento"]);
const allowedFotoContentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);
const allowedLaudoContentTypes = new Set(["application/pdf"]);
const allowedContentTypesByKind: Record<z.infer<typeof arquivoKindSchema>, ReadonlySet<string>> = {
  foto: allowedFotoContentTypes,
  laudo: allowedLaudoContentTypes,
  documento: ALLOWED_UPLOAD_CONTENT_TYPES,
};
const presignArquivoSchema = z.object({
  kind: arquivoKindSchema,
  filename: z.string().trim().min(1).max(180),
  size: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
  contentType: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .transform((value) => normalizeUploadContentType(value))
    .refine((value) => isAllowedUploadContentType(value), "Tipo de arquivo nao permitido"),
}).superRefine((value, ctx) => {
  const allowedByKind = allowedContentTypesByKind[value.kind];
  if (!allowedByKind.has(value.contentType)) {
    const message =
      value.kind === "foto"
        ? "Para foto, envie imagem (JPG, PNG, WEBP, GIF, HEIC ou HEIF)."
        : value.kind === "laudo"
          ? "Para laudo, envie arquivo PDF."
          : "Tipo de arquivo nao permitido para documento.";
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message,
      path: ["contentType"],
    });
  }
});
const commitArquivoSchema = z.object({
  kind: arquivoKindSchema,
  key: z.string().trim().min(1).max(255).nullable(),
});

function parsePacienteId(value: number): number {
  const idNum = Number(value);
  if (!Number.isFinite(idNum) || idNum <= 0 || !Number.isInteger(idNum)) {
    throw new AppError("Paciente invalido", 400, "INVALID_INPUT");
  }
  return idNum;
}

async function assertPacienteExists(pacienteId: number) {
  const [row] = await db
    .select({ id: pacientes.id })
    .from(pacientes)
    .where(and(eq(pacientes.id, pacienteId), isNull(pacientes.deletedAt)))
    .limit(1);
  if (!row) throw new AppError("Paciente nao encontrado", 404, "NOT_FOUND");
}

export async function obterArquivoPacienteReadUrlAction(
  pacienteId: number,
  kind: unknown
): Promise<ActionResult<{ url: string | null; key: string | null; expiresInSeconds?: number }>> {
  try {
    const idNum = parsePacienteId(pacienteId);
    const parsedKind = arquivoKindSchema.parse(kind);
    const { user, access } = await requirePermission("pacientes:view");
    await assertPacienteAccess(user, idNum, access);

    const [row] = await db
      .select({
        id: pacientes.id,
        foto: pacientes.foto,
        laudo: pacientes.laudo,
        documento: pacientes.documento,
      })
      .from(pacientes)
      .where(and(eq(pacientes.id, idNum), isNull(pacientes.deletedAt)))
      .limit(1);
    if (!row) throw new AppError("Paciente nao encontrado", 404, "NOT_FOUND");

    const key =
      parsedKind === "foto"
        ? row.foto
        : parsedKind === "laudo"
          ? row.laudo
          : row.documento;
    if (!key) return { ok: true, data: { url: null, key: null } };

    if (/^https?:\/\//i.test(key)) {
      return { ok: true, data: { url: key, key } };
    }

    const url = await createSignedReadUrl(key, 300);
    return { ok: true, data: { url, key, expiresInSeconds: 300 } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function prepararUploadArquivoPacienteAction(
  pacienteId: number,
  input: unknown
): Promise<ActionResult<{ key: string; url: string; expiresInSeconds: number }>> {
  try {
    const idNum = parsePacienteId(pacienteId);
    const parsed = presignArquivoSchema.parse(input ?? {});
    const { user, access } = await requirePermission("pacientes:edit");
    await assertPacienteAccess(user, idNum, access);
    await assertPacienteExists(idNum);

    const prefix = `pacientes/temp/${idNum}/${parsed.kind}`;
    const key = buildObjectKey(prefix, patientUploadFilename(idNum, parsed.kind, parsed.filename));
    patientFinalKey(idNum, parsed.kind, key);
    const url = await createSignedWriteUrl({
      key,
      contentType: parsed.contentType,
      contentLength: parsed.size,
      expiresInSeconds: 300,
    });

    return { ok: true, data: { key, url, expiresInSeconds: 300 } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

// A limpeza tambem segura a linha: outra operacao nao pode referenciar a chave
// entre a verificacao e o DELETE externo (inclusive depois de rollback).
async function deleteUnreferencedFile(patientId: number, kind: "foto" | "laudo" | "documento", key: string) {
  await runDbTransaction(async (tx) => {
    const [row] = await tx.select({ value: pacientes[kind] }).from(pacientes)
      .where(eq(pacientes.id, patientId)).limit(1).for("update");
    if (row?.value !== key) await deleteObjectFromR2(key);
  }, { mode: "required", operation: "pacientes.arquivos.cleanup" });
}

export async function commitArquivoPacienteAction(
  pacienteId: number,
  input: unknown
): Promise<ActionResult<{ ok: true }>> {
  try {
    const idNum = parsePacienteId(pacienteId);
    const parsed = commitArquivoSchema.parse(input ?? {});
    const { user, access } = await requirePermission("pacientes:edit");
    await assertPacienteAccess(user, idNum, access);
    const nextKey = parsed.key ? patientFinalKey(idNum, parsed.kind, parsed.key) : null;
    const tempKey = parsed.key?.startsWith(`pacientes/temp/${idNum}/${parsed.kind}/`) ? parsed.key : null;
    let copiedKey: string | null = null;
    let previousKey: string | null = null;
    try {
      previousKey = await runDbTransaction(async (tx) => {
        const active = and(eq(pacientes.id, idNum), isNull(pacientes.deletedAt));
        const [row] = await tx.select({ value: pacientes[parsed.kind] }).from(pacientes)
          .where(active).limit(1).for("update");
        if (!row) throw new AppError("Paciente nao encontrado", 404, "NOT_FOUND");
        if (parsed.key && !tempKey && parsed.key !== row.value) {
          throw new AppError("Anexo alterado. Atualize o cadastro e envie novamente.", 409, "STALE_FILE");
        }
        // Repetir um commit bem-sucedido nao copia nem apaga o objeto vigente.
        const alreadyCommitted = nextKey != null && nextKey === row.value;
        const sourceKey = alreadyCommitted ? nextKey : parsed.key;
        if (sourceKey) {
          const meta = await headObjectMetadataInR2(sourceKey);
          if (!meta) throw new AppError("Upload nao encontrado ou expirado, envie novamente", 409, "UPLOAD_EXPIRED");
          if (meta.size <= 0 || meta.size > MAX_UPLOAD_BYTES) throw new AppError("Arquivo excede o tamanho permitido (20 MB)", 400, "UPLOAD_TOO_LARGE");
          if (!allowedContentTypesByKind[parsed.kind].has(meta.contentType)) throw new AppError("Conteudo do arquivo nao corresponde ao tipo esperado", 400, "INVALID_CONTENT_TYPE");
        }
        if (alreadyCommitted) return null;
        if (tempKey && nextKey) {
          await copyObjectInR2({ sourceKey: tempKey, destinationKey: nextKey });
          copiedKey = nextKey;
        }
        await tx.update(pacientes).set({ [parsed.kind]: nextKey, updatedAt: sql`now()` }).where(active);
        return row.value;
      }, { operation: "pacientes.arquivos.commit.action", mode: "required" });
    } catch (error) {
      if (copiedKey) {
        await deleteUnreferencedFile(idNum, parsed.kind, copiedKey).catch(() => {
          console.error("[r2] Falha na limpeza apos rollback de anexo");
        });
      }
      throw error;
    }
    for (const key of [previousKey, tempKey]) {
      if (key && key !== nextKey) {
        await deleteUnreferencedFile(idNum, parsed.kind, key).catch(() => {
          console.error("[r2] Falha na limpeza apos confirmar anexo");
        });
      }
    }
    revalidatePath(`/pacientes/${idNum}`);
    revalidatePath(`/pacientes/${idNum}/editar`);
    revalidatePath("/pacientes");
    return { ok: true, data: { ok: true } };
  } catch (error) {
    return actionErrorResult(error);
  }
}
