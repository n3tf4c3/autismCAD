import { requireUser } from "@/server/auth/auth";
import { loadUserAccess } from "@/server/auth/access";
import { toAppError } from "@/server/shared/errors";
import { jsonError } from "@/server/shared/http";

export async function GET() {
  try {
    const sessionUser = await requireUser();
    const access = await loadUserAccess(Number(sessionUser.id));
    if (!access.exists || !access.user) {
      return Response.json(
        { error: "Usuario nao encontrado" },
        { status: 401 }
      );
    }

    return Response.json({
      role: access.primaryRole ?? null,
      roles: access.roles,
      permissions: Array.from(access.permissions),
      user: {
        id: access.user.id,
        nome: access.user.nome,
        email: access.user.email,
      },
    });
  } catch (error) {
    return jsonError(toAppError(error));
  }
}
