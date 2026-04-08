"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { canonicalRoleName } from "@/server/auth/permissions";
import {
  atualizarEvolucao,
  criarEvolucao,
  excluirDocumento,
  excluirEvolucao,
  finalizarDocumento,
  obterDocumento,
  obterEvolucaoPorId,
  salvarDocumento,
} from "@/server/modules/prontuario/prontuario.service";
import {
  atualizarEvolucaoSchema,
  criarEvolucaoSchema,
  salvarDocumentoSchema,
} from "@/server/modules/prontuario/prontuario.schema";
import { AppError, toAppError } from "@/server/shared/errors";
import type { UserAccess } from "@/server/auth/access";

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

function parsePositiveInt(value: number, label: string, code: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    throw new AppError(`${label} invalido`, 400, code);
  }
  return parsed;
}

function assertCamelCaseEvolucaoInput(input: unknown) {
  if (!input || typeof input !== "object") return;
  const payload = input as Record<string, unknown>;
  if ("atendimento_id" in payload || "profissional_id" in payload || "terapeuta_id" in payload) {
    throw new AppError(
      "Formato legado nao suportado. Use atendimentoId e profissionalId.",
      400,
      "INVALID_INPUT"
    );
  }
}

async function canAccessEvolucao(
  user: { role?: string | null; id: string | number },
  pacienteId: number,
  profissionalId: number | null,
  access?: UserAccess
): Promise<boolean> {
  const pacienteAccess = await assertPacienteAccess(user, pacienteId, access);
  if ((canonicalRoleName(user.role ?? null) ?? user.role ?? null) !== "PROFISSIONAL") {
    return true;
  }
  const accessProfissionalId = pacienteAccess.profissionalId;
  return !!accessProfissionalId && accessProfissionalId === profissionalId;
}

export async function criarEvolucaoAction(
  pacienteId: number,
  input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof criarEvolucao>>>> {
  try {
    const parsedPacienteId = parsePositiveInt(pacienteId, "Paciente", "INVALID_PACIENTE");
    const { user, access } = await requirePermission("evolucoes:create");
    await assertPacienteAccess(user, parsedPacienteId, access);
    assertCamelCaseEvolucaoInput(input);
    const parsedInput = criarEvolucaoSchema.parse(input ?? {});
    const saved = await criarEvolucao(parsedPacienteId, parsedInput, user);
    revalidatePath(`/prontuario/${parsedPacienteId}`);
    revalidatePath(`/prontuario/${parsedPacienteId}/evolucao/nova`);
    return { ok: true, data: saved };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function atualizarEvolucaoAction(
  evolucaoId: number,
  input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof atualizarEvolucao>>>> {
  try {
    const parsedEvolucaoId = parsePositiveInt(evolucaoId, "Evolucao", "INVALID_INPUT");
    const { user, access } = await requirePermission("evolucoes:edit");
    const evolucaoAtual = await obterEvolucaoPorId(parsedEvolucaoId);
    if (!evolucaoAtual) throw new AppError("Evolucao nao encontrada", 404, "NOT_FOUND");

    const canAccess = await canAccessEvolucao(
      user,
      Number(evolucaoAtual.pacienteId),
      Number(evolucaoAtual.profissionalId),
      access
    );
    if (!canAccess) throw new AppError("Acesso negado", 403, "FORBIDDEN");

    assertCamelCaseEvolucaoInput(input);
    const parsedInput = atualizarEvolucaoSchema.parse(input ?? {});
    const updated = await atualizarEvolucao(parsedEvolucaoId, parsedInput, user, evolucaoAtual);
    const pacienteId = Number(evolucaoAtual.pacienteId);
    revalidatePath(`/prontuario/${pacienteId}`);
    revalidatePath(`/prontuario/${pacienteId}/evolucao/${parsedEvolucaoId}`);
    return { ok: true, data: updated };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function excluirEvolucaoAction(
  evolucaoId: number
): Promise<ActionResult<{ id: number; deleted: true }>> {
  try {
    const parsedEvolucaoId = parsePositiveInt(evolucaoId, "Evolucao", "INVALID_INPUT");
    const { user, access } = await requirePermission("evolucoes:delete");
    const evolucaoAtual = await obterEvolucaoPorId(parsedEvolucaoId);
    if (!evolucaoAtual) throw new AppError("Evolucao nao encontrada", 404, "NOT_FOUND");

    const canAccess = await canAccessEvolucao(
      user,
      Number(evolucaoAtual.pacienteId),
      Number(evolucaoAtual.profissionalId),
      access
    );
    if (!canAccess) throw new AppError("Acesso negado", 403, "FORBIDDEN");

    const ok = await excluirEvolucao(parsedEvolucaoId, user.id);
    if (!ok) throw new AppError("Evolucao nao encontrada", 404, "NOT_FOUND");

    const pacienteId = Number(evolucaoAtual.pacienteId);
    revalidatePath(`/prontuario/${pacienteId}`);
    revalidatePath(`/prontuario/${pacienteId}/evolucao/${parsedEvolucaoId}`);
    return { ok: true, data: { id: parsedEvolucaoId, deleted: true } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function salvarDocumentoProntuarioAction(
  pacienteId: number,
  input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof salvarDocumento>>>> {
  try {
    const parsedPacienteId = parsePositiveInt(pacienteId, "Paciente", "INVALID_PACIENTE");
    const { user, access } = await requirePermission("prontuario:create");
    await assertPacienteAccess(user, parsedPacienteId, access);
    const parsedInput = salvarDocumentoSchema.parse(input ?? {});
    const saved = await salvarDocumento(parsedPacienteId, parsedInput, user);
    revalidatePath(`/prontuario/${parsedPacienteId}`);
    revalidatePath(`/prontuario/${parsedPacienteId}/plano-ensino`);
    revalidatePath(`/prontuario/documento/${saved.id}`);
    return { ok: true, data: saved };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function excluirDocumentoProntuarioAction(
  documentoId: number
): Promise<ActionResult<{ id: number; deleted: true }>> {
  try {
    const parsedDocumentoId = parsePositiveInt(documentoId, "Documento", "INVALID_INPUT");
    const { user, access } = await requirePermission("prontuario:delete");
    const documentoAtual = await obterDocumento(parsedDocumentoId);
    if (!documentoAtual) throw new AppError("Documento nao encontrado", 404, "NOT_FOUND");

    await assertPacienteAccess(user, Number(documentoAtual.pacienteId), access);

    const ok = await excluirDocumento(parsedDocumentoId, user.id);
    if (!ok) throw new AppError("Documento nao encontrado", 404, "NOT_FOUND");

    const pacienteId = Number(documentoAtual.pacienteId);
    revalidatePath(`/prontuario/${pacienteId}`);
    revalidatePath(`/prontuario/${pacienteId}/plano-ensino`);
    revalidatePath(`/prontuario/documento/${parsedDocumentoId}`);
    return { ok: true, data: { id: parsedDocumentoId, deleted: true } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function finalizarDocumentoProntuarioAction(
  documentoId: number
): Promise<ActionResult<{ id: number; finalized: true }>> {
  try {
    const parsedDocumentoId = parsePositiveInt(documentoId, "Documento", "INVALID_INPUT");
    const { user, access } = await requirePermission("prontuario:version");
    const finalized = await finalizarDocumento(parsedDocumentoId, user, access);

    const pacienteId = Number(finalized.pacienteId ?? 0);
    if (pacienteId > 0) {
      revalidatePath(`/prontuario/${pacienteId}`);
      revalidatePath(`/prontuario/${pacienteId}/plano-ensino`);
    }
    revalidatePath(`/prontuario/documento/${parsedDocumentoId}`);

    return { ok: true, data: { id: finalized.id, finalized: true } };
  } catch (error) {
    return actionErrorResult(error);
  }
}
