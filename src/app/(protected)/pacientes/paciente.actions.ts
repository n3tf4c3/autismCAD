"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { pacientes } from "@/server/db/schema";
import { runDbTransaction } from "@/server/db/transaction";
import {
  pacientesQuerySchema,
  savePacienteSchema,
} from "@/server/modules/pacientes/pacientes.schema";
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
  buildObjectKey,
  copyObjectInR2,
  createSignedReadUrl,
  createSignedWriteUrl,
  deleteObjectFromR2,
  isAllowedUploadContentType,
  normalizeUploadContentType,
  objectExistsInR2,
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
      const { user } = await requirePermission("pacientes:edit");
      await assertPacienteAccess(user, idNum);
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
    const { user } = await requirePermission("pacientes:edit");
    const idNum = Number(pacienteId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      throw new AppError("Paciente invalido", 400, "INVALID_INPUT");
    }
    await assertPacienteAccess(user, idNum);

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

    const { user } = await requirePermission("pacientes:delete");
    await assertPacienteAccess(user, idNum);
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

function looksLikeR2Key(value: string): boolean {
  const v = value.trim().toLowerCase();
  return !v.startsWith("http://") && !v.startsWith("https://");
}

function isNotFoundR2Error(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    name?: string;
    Code?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const status = candidate.$metadata?.httpStatusCode;
  const code = String(candidate.name ?? candidate.Code ?? candidate.code ?? "");
  return status === 404 || code === "NotFound" || code === "NoSuchKey";
}

export async function obterArquivoPacienteReadUrlAction(
  pacienteId: number,
  kind: unknown
): Promise<ActionResult<{ url: string | null; key: string | null; expiresInSeconds?: number }>> {
  try {
    const idNum = parsePacienteId(pacienteId);
    const parsedKind = arquivoKindSchema.parse(kind);
    const { user } = await requirePermission("pacientes:view");
    await assertPacienteAccess(user, idNum);

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
    const { user } = await requirePermission("pacientes:edit");
    await assertPacienteAccess(user, idNum);
    await assertPacienteExists(idNum);

    const prefix = `pacientes/temp/${idNum}/${parsed.kind}`;
    const key = buildObjectKey(prefix, parsed.filename);
    const url = await createSignedWriteUrl({
      key,
      contentType: parsed.contentType,
      expiresInSeconds: 300,
    });

    return { ok: true, data: { key, url, expiresInSeconds: 300 } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function commitArquivoPacienteAction(
  pacienteId: number,
  input: unknown
): Promise<ActionResult<{ ok: true }>> {
  try {
    const idNum = parsePacienteId(pacienteId);
    const parsed = commitArquivoSchema.parse(input ?? {});
    const { user } = await requirePermission("pacientes:edit");
    await assertPacienteAccess(user, idNum);

    let nextKey: string | null = parsed.key ?? null;
    let tempKeyToDelete: string | null = null;
    let promotedKeyToRollback: string | null = null;

    if (parsed.key) {
      if (!looksLikeR2Key(parsed.key)) {
        throw new AppError("Formato de arquivo invalido", 400, "INVALID_INPUT");
      }

      const tempPrefix = `pacientes/temp/${idNum}/${parsed.kind}/`;
      const finalPrefix = `pacientes/${idNum}/${parsed.kind}/`;
      const isTempKey = parsed.key.startsWith(tempPrefix);
      const isFinalKey = parsed.key.startsWith(finalPrefix);

      if (!isTempKey && !isFinalKey) {
        throw new AppError("Arquivo invalido para este paciente", 403, "FORBIDDEN");
      }

      if (isTempKey) {
        const fileName = parsed.key.split("/").pop() || `${parsed.kind}.bin`;
        const promotedKey = buildObjectKey(`pacientes/${idNum}/${parsed.kind}`, fileName);
        try {
          await copyObjectInR2({
            sourceKey: parsed.key,
            destinationKey: promotedKey,
          });
        } catch (error) {
          if (isNotFoundR2Error(error)) {
            throw new AppError(
              "Arquivo temporario nao encontrado ou expirado, envie novamente",
              409,
              "UPLOAD_EXPIRED"
            );
          }
          throw new AppError(
            "Falha ao consolidar upload na nuvem, tente novamente",
            500,
            "UPLOAD_FINALIZATION_FAILED"
          );
        }
        nextKey = promotedKey;
        tempKeyToDelete = parsed.key;
        promotedKeyToRollback = promotedKey;
      } else {
        const exists = await objectExistsInR2(parsed.key);
        if (!exists) {
          throw new AppError(
            "O upload na nuvem nao foi confirmado, tente novamente",
            409,
            "UPLOAD_NOT_CONFIRMED"
          );
        }
      }
    }

    let previousKey: string | null = null;
    try {
      const result = await runDbTransaction(
        async (tx) => {
          const pacienteAtivoWhere = and(eq(pacientes.id, idNum), isNull(pacientes.deletedAt));
          const [row] = await tx
            .select({
              id: pacientes.id,
              foto: pacientes.foto,
              laudo: pacientes.laudo,
              documento: pacientes.documento,
            })
            .from(pacientes)
            .where(pacienteAtivoWhere)
            .limit(1);
          if (!row) throw new AppError("Paciente nao encontrado", 404, "NOT_FOUND");

          const previousKey =
            parsed.kind === "foto"
              ? row.foto
              : parsed.kind === "laudo"
                ? row.laudo
                : row.documento;

          if (parsed.kind === "foto") {
            const [updated] = await tx
              .update(pacientes)
              .set({ foto: nextKey, updatedAt: sql`now()` })
              .where(pacienteAtivoWhere)
              .returning({ id: pacientes.id });
            if (!updated) throw new AppError("Paciente nao encontrado", 404, "NOT_FOUND");
          } else if (parsed.kind === "laudo") {
            const [updated] = await tx
              .update(pacientes)
              .set({ laudo: nextKey, updatedAt: sql`now()` })
              .where(pacienteAtivoWhere)
              .returning({ id: pacientes.id });
            if (!updated) throw new AppError("Paciente nao encontrado", 404, "NOT_FOUND");
          } else {
            const [updated] = await tx
              .update(pacientes)
              .set({ documento: nextKey, updatedAt: sql`now()` })
              .where(pacienteAtivoWhere)
              .returning({ id: pacientes.id });
            if (!updated) throw new AppError("Paciente nao encontrado", 404, "NOT_FOUND");
          }

          return { previousKey };
        },
        { operation: "pacientes.arquivos.commit.action", mode: "required" }
      );
      previousKey = result.previousKey;
      promotedKeyToRollback = null;
    } catch (error) {
      if (promotedKeyToRollback && looksLikeR2Key(promotedKeyToRollback)) {
        await deleteObjectFromR2(promotedKeyToRollback).catch(() => null);
      }
      throw error;
    }

    if (previousKey && previousKey !== nextKey && looksLikeR2Key(previousKey)) {
      await deleteObjectFromR2(previousKey).catch(() => null);
    }
    if (tempKeyToDelete && tempKeyToDelete !== nextKey && looksLikeR2Key(tempKeyToDelete)) {
      await deleteObjectFromR2(tempKeyToDelete).catch(() => null);
    }

    revalidatePath(`/pacientes/${idNum}`);
    revalidatePath(`/pacientes/${idNum}/editar`);
    revalidatePath("/pacientes");
    return { ok: true, data: { ok: true } };
  } catch (error) {
    return actionErrorResult(error);
  }
}
