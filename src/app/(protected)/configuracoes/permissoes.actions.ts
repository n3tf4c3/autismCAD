"use server";

import { requireAdminGeral } from "@/server/auth/auth";
import { AppError, toAppError } from "@/server/shared/errors";
import {
  createUserSchema,
  updateRolePermissionsSchema,
  updateUserSchema,
} from "@/server/modules/users/users.schema";
import {
  createUser,
  deleteUser,
  getRolePermissions,
  listPermissions,
  listRoles,
  listUsers,
  updateRolePermissions,
  updateUser,
} from "@/server/modules/users/users.service";
import { listarPacientes } from "@/server/modules/pacientes/pacientes.service";

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

function normalizeRoleName(raw: string): string {
  const roleName = decodeURIComponent(String(raw || "")).trim();
  if (!roleName) {
    throw new AppError("Role invalida", 400, "INVALID_ROLE");
  }
  return roleName;
}

export async function listRolesAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof listRoles>>>
> {
  try {
    await requireAdminGeral();
    const rows = await listRoles();
    return { ok: true, data: rows };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function listPermissionsAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof listPermissions>>>
> {
  try {
    await requireAdminGeral();
    const rows = await listPermissions();
    return { ok: true, data: rows };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function getRolePermissionsAction(
  role: string
): Promise<ActionResult<Awaited<ReturnType<typeof getRolePermissions>>>> {
  try {
    await requireAdminGeral();
    const roleName = normalizeRoleName(role);
    const result = await getRolePermissions(roleName);
    return { ok: true, data: result };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function updateRolePermissionsAction(
  role: string,
  payload: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof updateRolePermissions>>>> {
  try {
    await requireAdminGeral();
    const roleName = normalizeRoleName(role);
    const parsed = updateRolePermissionsSchema.parse(payload);
    const result = await updateRolePermissions(roleName, parsed);
    return { ok: true, data: result };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function listUsersAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof listUsers>>>
> {
  try {
    await requireAdminGeral();
    const rows = await listUsers();
    return { ok: true, data: rows };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function listPacientesForConfigAction(): Promise<
  ActionResult<Array<{ id: number; nome: string | null }>>
> {
  try {
    await requireAdminGeral();
    const rows = await listarPacientes({});
    return {
      ok: true,
      data: rows.map((item) => ({ id: item.id, nome: item.nome ?? null })),
    };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function createUserAction(
  input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof createUser>>>> {
  try {
    await requireAdminGeral();
    const parsed = createUserSchema.parse(input);
    const saved = await createUser(parsed);
    return { ok: true, data: saved };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function updateUserAction(
  id: number,
  input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof updateUser>>>> {
  try {
    const parsedId = Number(id);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      throw new AppError("Usuario invalido", 400, "INVALID_INPUT");
    }
    const { user } = await requireAdminGeral();
    const parsed = updateUserSchema.parse(input);
    const result = await updateUser(parsedId, parsed, user.id);
    return { ok: true, data: result };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function deleteUserAction(
  id: number
): Promise<ActionResult<Awaited<ReturnType<typeof deleteUser>>>> {
  try {
    const parsedId = Number(id);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      throw new AppError("Usuario invalido", 400, "INVALID_INPUT");
    }
    const { user } = await requireAdminGeral();
    const result = await deleteUser(parsedId, user.id);
    return { ok: true, data: result };
  } catch (error) {
    return actionErrorResult(error);
  }
}
