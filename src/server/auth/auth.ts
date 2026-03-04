import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/server/db/schema";
import { AppError } from "@/server/shared/errors";
import { getAuthSession } from "@/server/auth/session";
import { canonicalRoleName } from "@/server/auth/permissions";
import { assertHasPermission, loadUserAccess } from "@/server/auth/access";

export async function requireUser() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new AppError("Nao autenticado", 401, "UNAUTHORIZED");
  }
  const userId = Number(session.user.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new AppError("Sessao invalida", 401, "UNAUTHORIZED");
  }
  const [activeUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        eq(users.ativo, true),
        isNull(users.deletedAt)
      )
    )
    .limit(1);
  if (!activeUser) {
    throw new AppError("Usuario inativo ou removido", 401, "UNAUTHORIZED");
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

export async function requireAdminGeral() {
  const user = await requireUser();
  const access = await loadUserAccess(Number(user.id));
  if (!access.exists) {
    throw new AppError("Usuario nao encontrado", 401, "UNAUTHORIZED");
  }
  const isAdminGeral = access.roles.some(
    (role) => (canonicalRoleName(role) ?? role) === "ADMIN_GERAL"
  );
  if (!isAdminGeral) {
    throw new AppError("Acesso restrito ao admin-geral", 403, "FORBIDDEN");
  }
  return { user, access };
}

export async function requirePermission(permissionKey: string | string[]) {
  const user = await requireUser();
  const access = await loadUserAccess(Number(user.id));
  if (!access.exists) {
    throw new AppError("Usuario nao encontrado", 401, "UNAUTHORIZED");
  }
  const keys = Array.isArray(permissionKey) ? permissionKey : [permissionKey];
  assertHasPermission(access, keys);
  return { user, access };
}
