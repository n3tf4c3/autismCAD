import { idParamSchema, parseJsonBody } from "@/lib/zod/api";
import { requireAdminGeral } from "@/server/auth/auth";
import { updateUserSchema } from "@/server/modules/users/users.schema";
import { deleteUser, updateUser } from "@/server/modules/users/users.service";
import { withErrorHandling } from "@/server/shared/http";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const PUT = withErrorHandling(async (request: Request, context: RouteContext) => {
  await requireAdminGeral();
  const { id } = idParamSchema.parse(await context.params);
  const input = await parseJsonBody(request, updateUserSchema);
  const result = await updateUser(id, input);
  return Response.json(result);
});

export const DELETE = withErrorHandling(async (_request: Request, context: RouteContext) => {
  const { user } = await requireAdminGeral();
  const { id } = idParamSchema.parse(await context.params);
  const result = await deleteUser(id, Number(user.id));
  return Response.json(result);
});
