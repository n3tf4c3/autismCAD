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
  salvarPaciente,
  setPacienteAtivo,
  softDeletePaciente,
} from "@/server/modules/pacientes/pacientes.service";
import { AppError, toAppError } from "@/server/shared/errors";
import {
  buildObjectKey,
  createSignedReadUrl,
  createSignedWriteUrl,
  deleteObjectFromR2,
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
      await requirePermission("pacientes:edit");
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
      await requirePermission("pacientes:edit");
      const savedId = await salvarPaciente(parsed, existing.id);
      revalidatePath("/pacientes");
      revalidatePath(`/pacientes/${savedId}`);
      revalidatePath(`/pacientes/${savedId}/editar`);
      revalidatePath(`/prontuario/${savedId}`);
      return { ok: true, data: { id: savedId, reaproveitado: true } };
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
    await requirePermission("pacientes:edit");
    const idNum = Number(pacienteId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      throw new AppError("Paciente invalido", 400, "INVALID_INPUT");
    }

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
    const result = await softDeletePaciente(idNum, Number(user.id));

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
    await requirePermission("pacientes:view");
    const parsed = pacientesQuerySchema.parse(filters ?? {});
    const rows = await listarPacientes(parsed);
    return { ok: true, data: { items: rows } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

const arquivoKindSchema = z.enum(["foto", "laudo", "documento"]);
const presignArquivoSchema = z.object({
  kind: arquivoKindSchema,
  filename: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(1).max(120),
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

    const prefix = `pacientes/${idNum}/${parsed.kind}`;
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

    if (parsed.key && looksLikeR2Key(parsed.key)) {
      const expectedPrefix = `pacientes/${idNum}/${parsed.kind}/`;
      if (!parsed.key.startsWith(expectedPrefix)) {
        throw new AppError("Arquivo invalido para este paciente", 403, "FORBIDDEN");
      }
      const exists = await objectExistsInR2(parsed.key);
      if (!exists) {
        throw new AppError(
          "O upload na nuvem nao foi confirmado, tente novamente",
          409,
          "UPLOAD_NOT_CONFIRMED"
        );
      }
    }

    const { previousKey } = await runDbTransaction(
      async (tx) => {
        const [row] = await tx
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

        const previousKey =
          parsed.kind === "foto"
            ? row.foto
            : parsed.kind === "laudo"
              ? row.laudo
              : row.documento;

        if (parsed.kind === "foto") {
          await tx
            .update(pacientes)
            .set({ foto: parsed.key, updatedAt: sql`now()` })
            .where(eq(pacientes.id, idNum));
        } else if (parsed.kind === "laudo") {
          await tx
            .update(pacientes)
            .set({ laudo: parsed.key, updatedAt: sql`now()` })
            .where(eq(pacientes.id, idNum));
        } else {
          await tx
            .update(pacientes)
            .set({ documento: parsed.key, updatedAt: sql`now()` })
            .where(eq(pacientes.id, idNum));
        }

        return { previousKey };
      },
      { operation: "pacientes.arquivos.commit.action", mode: "required" }
    );

    if (previousKey && previousKey !== parsed.key && looksLikeR2Key(previousKey)) {
      await deleteObjectFromR2(previousKey).catch(() => null);
    }

    revalidatePath(`/pacientes/${idNum}`);
    revalidatePath(`/pacientes/${idNum}/editar`);
    revalidatePath("/pacientes");
    return { ok: true, data: { ok: true } };
  } catch (error) {
    return actionErrorResult(error);
  }
}
