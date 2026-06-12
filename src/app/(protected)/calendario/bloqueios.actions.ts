"use server";

import { requirePermission } from "@/server/auth/auth";
import {
  criarBloqueios,
  excluirBloqueio,
  listarBloqueios,
} from "@/server/modules/agenda/bloqueios.service";
import {
  criarBloqueiosSchema,
  listarBloqueiosSchema,
} from "@/server/modules/agenda/bloqueios.schema";
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

export async function listarBloqueiosAction(
  input: unknown
): Promise<ActionResult<{ items: Awaited<ReturnType<typeof listarBloqueios>> }>> {
  try {
    await requirePermission("consultas:view");
    const parsed = listarBloqueiosSchema.parse(input ?? {});
    const items = await listarBloqueios(parsed);
    return { ok: true, data: { items } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function criarBloqueiosAction(
  input: unknown
): Promise<ActionResult<{ criados: number }>> {
  try {
    const { user } = await requirePermission("consultas:create");
    const parsed = criarBloqueiosSchema.parse(input ?? {});
    const result = await criarBloqueios(parsed, Number(user.id));
    return { ok: true, data: result };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function excluirBloqueioAction(
  id: number
): Promise<ActionResult<{ id: number }>> {
  try {
    const parsedId = Number(id);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      throw new AppError("Bloqueio invalido", 400, "INVALID_INPUT");
    }
    await requirePermission("consultas:cancel");
    const result = await excluirBloqueio(parsedId);
    return { ok: true, data: result };
  } catch (error) {
    return actionErrorResult(error);
  }
}
