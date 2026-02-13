import { idParamSchema, parseJsonBody } from "@/lib/zod/api";
import { loadUserAccess } from "@/server/auth/access";
import { requirePermission, requireUser } from "@/server/auth/auth";
import { hasPermissionKey } from "@/server/auth/permissions";
import { saveTerapeutaSchema } from "@/server/modules/terapeutas/terapeutas.schema";
import {
  deleteTerapeuta,
  obterTerapeutaPorUsuario,
  salvarTerapeuta,
} from "@/server/modules/terapeutas/terapeutas.service";
import { AppError, toAppError } from "@/server/shared/errors";
import { jsonError } from "@/server/shared/http";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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
