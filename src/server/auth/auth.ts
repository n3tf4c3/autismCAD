import "server-only";
import { AppError } from "@/server/shared/errors";
import { getAuthSession } from "@/server/auth/session";
import { canonicalRoleName } from "@/server/auth/permissions";

export async function requireUser() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new AppError("Nao autenticado", 401, "UNAUTHORIZED");
  }
  return session.user;
}

export async function requireRole(allowedRoles: string[]) {
  const user = await requireUser();
  const userRole = canonicalRoleName(user.role) ?? user.role;
  const allowed = new Set(allowedRoles.map((role) => canonicalRoleName(role) ?? role));
  if (!allowed.has(userRole)) {
    throw new AppError("Acesso negado", 403, "FORBIDDEN");
  }
  return user;
}
