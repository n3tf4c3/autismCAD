import { idParamSchema, parseJsonBody } from "@/lib/zod/api";
import { requireAdminGeral } from "@/server/auth/auth";
import { updateUserSchema } from "@/server/modules/users/users.schema";
import { deleteUser, updateUser } from "@/server/modules/users/users.service";
import { toAppError } from "@/server/shared/errors";
import { jsonError } from "@/server/shared/http";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  try {
    await requireAdminGeral();
    const { id } = idParamSchema.parse(await context.params);
    const input = await parseJsonBody(request, updateUserSchema);
    const result = await updateUser(id, input);
    return Response.json(result);
  } catch (error) {
    return jsonError(toAppError(error));
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { user } = await requireAdminGeral();
    const { id } = idParamSchema.parse(await context.params);
    const result = await deleteUser(id, Number(user.id));
    return Response.json(result);
  } catch (error) {
    return jsonError(toAppError(error));
  }
}
