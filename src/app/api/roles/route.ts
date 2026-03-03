import { requireAdminGeral } from "@/server/auth/auth";
import { listRoles } from "@/server/modules/users/users.service";
import { withErrorHandlingNoContext } from "@/server/shared/http";

export const GET = withErrorHandlingNoContext(async () => {
  await requireAdminGeral();
  const rows = await listRoles();
  return Response.json(rows);
});
