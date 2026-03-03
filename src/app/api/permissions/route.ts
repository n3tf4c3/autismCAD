import { requireAdminGeral } from "@/server/auth/auth";
import { listPermissions } from "@/server/modules/users/users.service";
import { withErrorHandlingNoContext } from "@/server/shared/http";

export const GET = withErrorHandlingNoContext(async () => {
  await requireAdminGeral();
  const rows = await listPermissions();
  return Response.json(rows);
});
