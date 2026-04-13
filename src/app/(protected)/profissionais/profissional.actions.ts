"use server";

import { revalidatePath } from "next/cache";
import { loadUserAccess } from "@/server/auth/access";
import { requirePermission, requireUser } from "@/server/auth/auth";
import { ADMIN_ROLES, hasPermissionKey } from "@/server/auth/permissions";
import {
  saveProfissionalSchema,
  profissionaisQuerySchema,
} from "@/server/modules/profissionais/profissionais.schema";
import {
  deleteProfissional,
  listarProfissionais,
  obterProfissionalPorUsuario,
  salvarProfissional,
  setProfissionalAtivo,
} from "@/server/modules/profissionais/profissionais.service";
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

async function assertCanEditProfissional(profissionalId: number): Promise<number> {
  const user = await requireUser();
  const userId = user.id;
  const access = await loadUserAccess(userId);
  const roleForCheck = access.canonicalRole ?? access.role;
  const isAdmin = roleForCheck ? ADMIN_ROLES.has(roleForCheck) : false;
  if (isAdmin) return userId;
  const canEditAny = hasPermissionKey(access.permissions, "profissionais:edit");
  const canEditSelf = hasPermissionKey(access.permissions, "profissionais:edit_self");

  if (!canEditAny && !canEditSelf) {
    throw new AppError("Acesso negado", 403, "FORBIDDEN");
  }

  if (!canEditAny) {
    const self = await obterProfissionalPorUsuario(userId);
    if (!self || self.id !== profissionalId) {
      throw new AppError("Acesso negado", 403, "FORBIDDEN");
    }
  }

  return userId;
}

export async function salvarProfissionalAction(
  input: unknown,
  profissionalId?: number | null
): Promise<ActionResult<{ id: number }>> {
  try {
    const parsed = saveProfissionalSchema.parse(input);
    const idNum = profissionalId ? Number(profissionalId) : null;

    if (idNum && Number.isFinite(idNum) && idNum > 0) {
      await assertCanEditProfissional(idNum);
    } else {
      await requirePermission("profissionais:create");
    }

    const savedId = await salvarProfissional(parsed, idNum ?? null);
    revalidatePath("/profissionais");
    revalidatePath(`/profissionais/${savedId}`);
    revalidatePath(`/profissionais/${savedId}/editar`);

    return { ok: true, data: { id: savedId } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function setProfissionalAtivoAction(
  profissionalId: number,
  ativo: boolean
): Promise<ActionResult<{ id: number; ativo: boolean }>> {
  try {
    const idNum = Number(profissionalId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      throw new AppError("Profissional invalido", 400, "INVALID_INPUT");
    }

    await requirePermission("profissionais:edit");
    const result = await setProfissionalAtivo(idNum, Boolean(ativo));

    revalidatePath("/profissionais");
    revalidatePath(`/profissionais/${idNum}`);
    revalidatePath(`/profissionais/${idNum}/editar`);

    return { ok: true, data: { id: result.id, ativo: result.ativo } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function deleteProfissionalAction(
  profissionalId: number
): Promise<ActionResult<{ id: number }>> {
  try {
    const idNum = Number(profissionalId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      throw new AppError("Profissional invalido", 400, "INVALID_INPUT");
    }

    const { user } = await requirePermission("profissionais:delete");
    const result = await deleteProfissional(idNum, user.id);

    revalidatePath("/profissionais");
    revalidatePath(`/profissionais/${idNum}`);

    return { ok: true, data: { id: result.id } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function listarProfissionaisAction(
  filters: unknown
): Promise<ActionResult<{ items: Awaited<ReturnType<typeof listarProfissionais>> }>> {
  try {
    await requirePermission("profissionais:view");
    const parsed = profissionaisQuerySchema.parse(filters ?? {});
    const rows = await listarProfissionais(parsed);
    return { ok: true, data: { items: rows } };
  } catch (error) {
    return actionErrorResult(error);
  }
}
