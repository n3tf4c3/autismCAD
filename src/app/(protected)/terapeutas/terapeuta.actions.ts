"use server";

import { revalidatePath } from "next/cache";
import { loadUserAccess } from "@/server/auth/access";
import { requirePermission, requireUser } from "@/server/auth/auth";
import { hasPermissionKey } from "@/server/auth/permissions";
import {
  saveTerapeutaSchema,
  terapeutasQuerySchema,
} from "@/server/modules/terapeutas/terapeutas.schema";
import {
  deleteTerapeuta,
  listarTerapeutas,
  obterTerapeutaPorUsuario,
  salvarTerapeuta,
  setTerapeutaAtivo,
} from "@/server/modules/terapeutas/terapeutas.service";
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

type ActionResult<T> = ActionOk<T> | ActionError;

function actionErrorResult(error: unknown): ActionError {
  const appError = toAppError(error);
  return {
    ok: false,
    error: appError.message,
    code: appError.code,
    status: appError.status,
  };
}

async function assertCanEditTerapeuta(terapeutaId: number): Promise<number> {
  const user = await requireUser();
  const userId = Number(user.id);
  const access = await loadUserAccess(userId);
  const canEditAny = hasPermissionKey(access.permissions, "terapeutas:edit");
  const canEditSelf = hasPermissionKey(access.permissions, "terapeutas:edit_self");

  if (!canEditAny && !canEditSelf) {
    throw new AppError("Acesso negado", 403, "FORBIDDEN");
  }

  if (!canEditAny) {
    const self = await obterTerapeutaPorUsuario(userId);
    if (!self || self.id !== terapeutaId) {
      throw new AppError("Acesso negado", 403, "FORBIDDEN");
    }
  }

  return userId;
}

export async function salvarTerapeutaAction(input: unknown, terapeutaId?: number | null): Promise<ActionResult<{ id: number }>> {
  try {
    const parsed = saveTerapeutaSchema.parse(input);
    const idNum = terapeutaId ? Number(terapeutaId) : null;

    if (idNum && Number.isFinite(idNum) && idNum > 0) {
      await assertCanEditTerapeuta(idNum);
    } else {
      await requirePermission("terapeutas:create");
    }

    const savedId = await salvarTerapeuta(parsed, idNum ?? null);
    revalidatePath("/terapeutas");
    revalidatePath(`/terapeutas/${savedId}`);
    revalidatePath(`/terapeutas/${savedId}/editar`);

    return { ok: true, data: { id: savedId } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function setTerapeutaAtivoAction(
  terapeutaId: number,
  ativo: boolean
): Promise<ActionResult<{ id: number; ativo: boolean }>> {
  try {
    const idNum = Number(terapeutaId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      throw new AppError("Terapeuta invalido", 400, "INVALID_INPUT");
    }

    await assertCanEditTerapeuta(idNum);
    const result = await setTerapeutaAtivo(idNum, Boolean(ativo));

    revalidatePath("/terapeutas");
    revalidatePath(`/terapeutas/${idNum}`);
    revalidatePath(`/terapeutas/${idNum}/editar`);

    return { ok: true, data: { id: result.id, ativo: result.ativo } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function deleteTerapeutaAction(
  terapeutaId: number
): Promise<ActionResult<{ id: number }>> {
  try {
    const idNum = Number(terapeutaId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      throw new AppError("Terapeuta invalido", 400, "INVALID_INPUT");
    }

    const { user } = await requirePermission("terapeutas:delete");
    const result = await deleteTerapeuta(idNum, Number(user.id));

    revalidatePath("/terapeutas");
    revalidatePath(`/terapeutas/${idNum}`);

    return { ok: true, data: { id: result.id } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function listarTerapeutasAction(
  filters: unknown
): Promise<ActionResult<{ items: Awaited<ReturnType<typeof listarTerapeutas>> }>> {
  try {
    await requirePermission("terapeutas:view");
    const parsed = terapeutasQuerySchema.parse(filters ?? {});
    const rows = await listarTerapeutas(parsed);
    return { ok: true, data: { items: rows } };
  } catch (error) {
    return actionErrorResult(error);
  }
}
