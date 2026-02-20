import { idParamSchema, parseJsonBody } from "@/lib/zod/api";
import { loadUserAccess } from "@/server/auth/access";
import { requirePermission, requireUser } from "@/server/auth/auth";
import { hasPermissionKey } from "@/server/auth/permissions";
import { saveTerapeutaSchema } from "@/server/modules/terapeutas/terapeutas.schema";
import {
  deleteTerapeuta,
  obterTerapeutaPorUsuario,
  setTerapeutaAtivo,
  listarTerapeutas,
  salvarTerapeuta,
} from "@/server/modules/terapeutas/terapeutas.service";
import { AppError, toAppError } from "@/server/shared/errors";
import { jsonError } from "@/server/shared/http";
import { z } from "zod";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const patchTerapeutaSchema = z.object({
  ativo: z.union([z.boolean(), z.number(), z.string()]),
});

function parseAtivo(value: boolean | number | string): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const parsed = value.trim().toLowerCase();
  if (["1", "true", "ativo"].includes(parsed)) return true;
  if (["0", "false", "inativo", "arquivado"].includes(parsed)) return false;
  throw new AppError("Campo ativo invalido", 400, "INVALID_INPUT");
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission("terapeutas:view");
    const { id } = idParamSchema.parse(await context.params);
    const rows = await listarTerapeutas({ id });
    const row = rows?.[0] ?? null;
    if (!row) throw new AppError("Terapeuta nao encontrado", 404, "NOT_FOUND");
    return Response.json(row);
  } catch (error) {
    return jsonError(toAppError(error));
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const access = await loadUserAccess(Number(user.id));
    const canEditAny = hasPermissionKey(access.permissions, "terapeutas:edit");
    const canEditSelf = hasPermissionKey(access.permissions, "terapeutas:edit_self");
    if (!canEditAny && !canEditSelf) {
      throw new AppError("Acesso negado", 403, "FORBIDDEN");
    }

    const { id } = idParamSchema.parse(await context.params);
    if (!canEditAny) {
      const terapeuta = await obterTerapeutaPorUsuario(Number(user.id));
      if (!terapeuta || terapeuta.id !== id) {
        throw new AppError("Acesso negado", 403, "FORBIDDEN");
      }
    }

    const payload = await parseJsonBody(request, saveTerapeutaSchema);
    const savedId = await salvarTerapeuta(payload, id);
    return Response.json({ id: savedId });
  } catch (error) {
    return jsonError(toAppError(error));
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requirePermission("terapeutas:delete");
    const { id } = idParamSchema.parse(await context.params);
    const result = await deleteTerapeuta(id);
    return Response.json(result);
  } catch (error) {
    return jsonError(toAppError(error));
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const access = await loadUserAccess(Number(user.id));
    const canEditAny = hasPermissionKey(access.permissions, "terapeutas:edit");
    const canEditSelf = hasPermissionKey(access.permissions, "terapeutas:edit_self");
    if (!canEditAny && !canEditSelf) {
      throw new AppError("Acesso negado", 403, "FORBIDDEN");
    }

    const { id } = idParamSchema.parse(await context.params);
    if (!canEditAny) {
      const terapeuta = await obterTerapeutaPorUsuario(Number(user.id));
      if (!terapeuta || terapeuta.id !== id) {
        throw new AppError("Acesso negado", 403, "FORBIDDEN");
      }
    }

    const payload = await parseJsonBody(request, patchTerapeutaSchema);
    const ativo = parseAtivo(payload.ativo);
    const result = await setTerapeutaAtivo(id, ativo);
    return Response.json(result);
  } catch (error) {
    return jsonError(toAppError(error));
  }
}
