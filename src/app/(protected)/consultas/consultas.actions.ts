"use server";

import { requirePermission } from "@/server/auth/auth";
import {
  atendimentosQuerySchema,
  excluirDiaSchema,
  recorrenteSchema,
  saveAtendimentoSchema,
} from "@/server/modules/atendimentos/atendimentos.schema";
import {
  criarRecorrentes,
  excluirDia,
  listarAtendimentos,
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

export async function listarAtendimentosAction(
  filters: unknown
): Promise<ActionResult<{ items: Awaited<ReturnType<typeof listarAtendimentos>> }>> {
  try {
    await requirePermission("consultas:view");
    const parsed = atendimentosQuerySchema.parse(filters ?? {});
    const rows = await listarAtendimentos(parsed);
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
    await requirePermission(["consultas:edit", "consultas:presence"]);
    const idNum = Number(atendimentoId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      throw new AppError("Atendimento invalido", 400, "INVALID_INPUT");
    }
    const parsed = saveAtendimentoSchema.parse(input);
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
    await requirePermission("consultas:create");
    const parsed = saveAtendimentoSchema.parse(input);
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
    await requirePermission("consultas:create");
    const parsed = recorrenteSchema.parse(input);
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
    const result = await softDeleteAtendimento(idNum, Number(user.id));
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
    const result = await excluirDia(parsed, Number(user.id));
    return { ok: true, data: { removidos: result.removidos } };
  } catch (error) {
    return actionErrorResult(error);
  }
}
