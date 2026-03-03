import { requireUser } from "@/server/auth/auth";
import { loadUserAccess } from "@/server/auth/access";
import { withErrorHandlingNoContext } from "@/server/shared/http";

export const GET = withErrorHandlingNoContext(async () => {
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
});
