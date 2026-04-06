"use server";

import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import {
  atendimentosQuerySchema,
  excluirDiaSchema,
  recorrenteSchema,
  saveAtendimentoSchema,
} from "@/server/modules/atendimentos/atendimentos.schema";
import {
  criarRecorrentes,
  excluirDia,
  listarAtendimentosPorUsuario,
  salvarAtendimento,
  softDeleteAtendimento,
} from "@/server/modules/atendimentos/atendimentos.service";
import { AppError, toAppError } from "@/server/shared/errors";

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

function assertNoLegacyAtendimentoFields(input: unknown) {
  if (!input || typeof input !== "object") return;
  const payload = input as Record<string, unknown>;
  if ("realizado" in payload) {
    throw new AppError(
      "Campo legado nao suportado. Use apenas presenca; realizado e calculado no servidor.",
      400,
      "INVALID_INPUT"
    );
  }
}

export async function listarAtendimentosAction(
  filters: unknown
): Promise<ActionResult<{ items: Awaited<ReturnType<typeof listarAtendimentosPorUsuario>> }>> {
  try {
    const { user } = await requirePermission("consultas:view");
    const parsed = atendimentosQuerySchema.parse(filters ?? {});
    const rows = await listarAtendimentosPorUsuario(user.id, parsed);
    return { ok: true, data: { items: rows } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function salvarAtendimentoAction(
  atendimentoId: number,
  input: unknown
): Promise<ActionResult<{ id: number }>> {
  try {
    const { user } = await requirePermission(["consultas:edit", "consultas:presence"]);
    const idNum = Number(atendimentoId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      throw new AppError("Atendimento invalido", 400, "INVALID_INPUT");
    }
    assertNoLegacyAtendimentoFields(input);
    const parsed = saveAtendimentoSchema.parse(input);
    await assertPacienteAccess(user, parsed.pacienteId);
    const savedId = await salvarAtendimento(parsed, idNum);
    return { ok: true, data: { id: savedId } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function criarAtendimentoAction(
  input: unknown
): Promise<ActionResult<{ id: number }>> {
  try {
    const { user } = await requirePermission("consultas:create");
    assertNoLegacyAtendimentoFields(input);
    const parsed = saveAtendimentoSchema.parse(input);
    await assertPacienteAccess(user, parsed.pacienteId);
    const savedId = await salvarAtendimento(parsed, null);
    return { ok: true, data: { id: savedId } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function criarAtendimentosRecorrentesAction(
  input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof criarRecorrentes>>>> {
  try {
    const { user } = await requirePermission("consultas:create");
    const parsed = recorrenteSchema.parse(input);
    await assertPacienteAccess(user, parsed.pacienteId);
    const result = await criarRecorrentes(parsed);
    return { ok: true, data: result };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function excluirAtendimentoAction(
  atendimentoId: number
): Promise<ActionResult<{ id: number }>> {
  try {
    const idNum = Number(atendimentoId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      throw new AppError("Atendimento invalido", 400, "INVALID_INPUT");
    }
    const { user } = await requirePermission("consultas:cancel");
    const result = await softDeleteAtendimento(idNum, user.id);
    return { ok: true, data: { id: result.id } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function excluirDiaAtendimentosAction(
  input: unknown
): Promise<ActionResult<{ removidos: number }>> {
  try {
    const { user } = await requirePermission("consultas:cancel");
    const parsed = excluirDiaSchema.parse(input);
    await assertPacienteAccess(user, parsed.pacienteId);
    const result = await excluirDia(parsed, user.id);
    return { ok: true, data: { removidos: result.removidos } };
  } catch (error) {
    return actionErrorResult(error);
  }
}
