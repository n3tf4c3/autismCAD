import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/server/db/schema";
import { AppError } from "@/server/shared/errors";
import { getAuthSession } from "@/server/auth/session";
import { normalizeRoleForMatch } from "@/server/auth/permissions";
import { assertHasPermission, loadUserAccess } from "@/server/auth/access";
import { parseSessionUserId } from "@/server/auth/user-id";

export type AuthenticatedUser = {
  id: number;
  role?: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

async function requireSessionUser(): Promise<AuthenticatedUser> {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new AppError("Nao autenticado", 401, "UNAUTHORIZED");
  }
  const userId = parseSessionUserId(session.user.id);
  return { ...session.user, id: userId };
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await requireSessionUser();
  const [activeUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, user.id),
        eq(users.ativo, true),
        isNull(users.deletedAt)
      )
    )
    .limit(1);
  if (!activeUser) {
    throw new AppError("Usuario inativo ou removido", 401, "UNAUTHORIZED");
  }
  return user;
}

export async function requireRole(allowedRoles: string[]) {
  const user = await requireUser();
  const userRole = normalizeRoleForMatch(user.role);
  const allowed = new Set(
    allowedRoles
      .map((role) => normalizeRoleForMatch(role))
      .filter((role): role is string => Boolean(role))
  );
  if (!userRole || !allowed.has(userRole)) {
    throw new AppError("Acesso negado", 403, "FORBIDDEN");
  }
  return user;
}

export async function requireAdminGeral() {
  const user = await requireSessionUser();
  const access = await loadUserAccess(user.id);
  if (!access.exists) {
    throw new AppError("Usuario nao encontrado", 401, "UNAUTHORIZED");
  }
  const isAdminGeral = (access.canonicalRole ?? access.role) === "ADMIN_GERAL";
  if (!isAdminGeral) {
    throw new AppError("Acesso restrito ao admin-geral", 403, "FORBIDDEN");
  }
  return { user, access };
}

export async function requirePermission(permissionKey: string | string[]) {
  const user = await requireSessionUser();
  const access = await loadUserAccess(user.id);
  if (!access.exists) {
    throw new AppError("Usuario inativo ou removido", 401, "UNAUTHORIZED");
  }
  const keys = Array.isArray(permissionKey) ? permissionKey : [permissionKey];
  assertHasPermission(access, keys);
  return { user, access };
}
