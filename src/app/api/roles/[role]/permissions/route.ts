import { parseJsonBody } from "@/lib/zod/api";
import { requireAdminGeral } from "@/server/auth/auth";
import { updateRolePermissionsSchema } from "@/server/modules/users/users.schema";
import {
  getRolePermissions,
  updateRolePermissions,
} from "@/server/modules/users/users.service";
import { AppError } from "@/server/shared/errors";
import { withErrorHandling } from "@/server/shared/http";

type RouteContext = {
  params: Promise<{ role: string }>;
};

function normalizeRole(raw: string) {
  const role = decodeURIComponent(raw || "").trim();
  if (!role) {
    throw new AppError("Role invalida", 400, "INVALID_ROLE");
  }
  return role;
}

export const GET = withErrorHandling(async (_request: Request, context: RouteContext) => {
  await requireAdminGeral();
  const params = await context.params;
  const roleName = normalizeRole(params.role);
  const result = await getRolePermissions(roleName);
  return Response.json(result);
});

export const POST = withErrorHandling(async (request: Request, context: RouteContext) => {
  await requireAdminGeral();
  const params = await context.params;
  const roleName = normalizeRole(params.role);
  const payload = await parseJsonBody(request, updateRolePermissionsSchema);
  const result = await updateRolePermissions(roleName, payload);
  return Response.json(result);
});
