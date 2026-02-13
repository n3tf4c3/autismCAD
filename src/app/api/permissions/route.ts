import { requireAdminGeral } from "@/server/auth/auth";
import { listPermissions } from "@/server/modules/users/users.service";
import { toAppError } from "@/server/shared/errors";
import { jsonError } from "@/server/shared/http";

export async function GET() {
  try {
    await requireAdminGeral();
    const rows = await listPermissions();
    return Response.json(rows);
  } catch (error) {
    return jsonError(toAppError(error));
  }
}
