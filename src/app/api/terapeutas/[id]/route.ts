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
import { AppError } from "@/server/shared/errors";
import { withErrorHandling } from "@/server/shared/http";
import { parseAtivo, patchAtivoSchema } from "@/server/shared/parse-ativo";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const GET = withErrorHandling(async (_request: Request, context: RouteContext) => {
  await requirePermission("terapeutas:view");
  const { id } = idParamSchema.parse(await context.params);
  const rows = await listarTerapeutas({ id });
  const row = rows?.[0] ?? null;
  if (!row) throw new AppError("Terapeuta nao encontrado", 404, "NOT_FOUND");
  return Response.json(row);
});

export const PUT = withErrorHandling(async (request: Request, context: RouteContext) => {
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
});

export const DELETE = withErrorHandling(async (_request: Request, context: RouteContext) => {
  const { user } = await requirePermission("terapeutas:delete");
  const { id } = idParamSchema.parse(await context.params);
  const result = await deleteTerapeuta(id, Number(user.id));
  return Response.json(result);
});

export const PATCH = withErrorHandling(async (request: Request, context: RouteContext) => {
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

  const payload = await parseJsonBody(request, patchAtivoSchema);
  const ativo = parseAtivo(payload.ativo);
  const result = await setTerapeutaAtivo(id, ativo);
  return Response.json(result);
});
