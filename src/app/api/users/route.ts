import { parseJsonBody } from "@/lib/zod/api";
import { requireAdminGeral } from "@/server/auth/auth";
import {
  createUserSchema,
} from "@/server/modules/users/users.schema";
import { createUser, listUsers } from "@/server/modules/users/users.service";
import { withErrorHandlingNoContext } from "@/server/shared/http";

export const GET = withErrorHandlingNoContext(async () => {
  await requireAdminGeral();
  const rows = await listUsers();
  return Response.json(rows);
});

export const POST = withErrorHandlingNoContext(async (request: Request) => {
  await requireAdminGeral();
  const input = await parseJsonBody(request, createUserSchema);
  const saved = await createUser(input);
  return Response.json(
    { id: saved.id, email: saved.email, role: saved.role },
    { status: 201 }
  );
});
