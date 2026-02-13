import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { permissions, rolePermissions, users } from "@/server/db/schema";
import {
  ADMIN_ROLES,
  canonicalRoleName,
  hasPermissionKey,
} from "@/server/auth/permissions";
import { AppError } from "@/server/shared/errors";

export type UserAccess = {
  exists: boolean;
  roles: string[];
  primaryRole: string | null;
  permissions: Set<string>;
  user: {
    id: number;
    nome: string;
    email: string;
  } | null;
};

export async function loadUserAccess(userId: number): Promise<UserAccess> {
  if (!Number.isFinite(userId) || userId <= 0) {
    return {
      exists: false,
      roles: [],
      primaryRole: null,
      permissions: new Set<string>(),
      user: null,
    };
  }

  const [user] = await db
    .select({
      id: users.id,
      nome: users.nome,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return {
      exists: false,
      roles: [],
      primaryRole: null,
      permissions: new Set<string>(),
      user: null,
    };
  }

  const primaryRole = canonicalRoleName(user.role) ?? user.role;
  const rolesResolved = Array.from(new Set([primaryRole, user.role].filter(Boolean)));

  const permissionRows = await db
    .select({
      resource: permissions.resource,
      action: permissions.action,
    })
    .from(rolePermissions)
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(rolePermissions.role, user.role));

  const permissionsSet = new Set(
    permissionRows
      .filter((row) => row.resource && row.action)
      .map((row) => `${row.resource}:${row.action}`)
  );

  return {
    exists: true,
    roles: rolesResolved,
    primaryRole,
    permissions: permissionsSet,
    user: {
      id: user.id,
      nome: user.nome,
      email: user.email,
    },
  };
}

export function assertHasPermission(
  access: UserAccess,
  permissionKeys: string[]
): void {
  const isAdmin = access.roles.some((role) =>
    ADMIN_ROLES.has(canonicalRoleName(role) ?? role)
  );
  if (isAdmin) return;

  const ok = permissionKeys.some((key) => hasPermissionKey(access.permissions, key));
  if (!ok) {
    throw new AppError("Acesso negado", 403, "FORBIDDEN");
  }
}
