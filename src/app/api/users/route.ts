import { parseJsonBody } from "@/lib/zod/api";
import { requireAdminGeral } from "@/server/auth/auth";
import {
  createUserSchema,
} from "@/server/modules/users/users.schema";
import { createUser, listUsers } from "@/server/modules/users/users.service";
import { toAppError } from "@/server/shared/errors";
import { jsonError } from "@/server/shared/http";

export async function GET() {
  try {
    await requireAdminGeral();
    const rows = await listUsers();
    return Response.json(rows);
  } catch (error) {
    return jsonError(toAppError(error));
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminGeral();
    const input = await parseJsonBody(request, createUserSchema);
    const saved = await createUser(input);
    return Response.json(
      { id: saved.id, email: saved.email, role: saved.role },
      { status: 201 }
    );
  } catch (error) {
    return jsonError(toAppError(error));
  }
}
