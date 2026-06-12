import { canonicalRoleName } from "@/server/auth/permissions";
import type { UserAccess } from "@/server/auth/access";
import type { AuthenticatedUser } from "@/server/auth/auth";

// Deriva o papel efetivo a partir do `access` fresco do banco quando disponivel,
// evitando usar a role do JWT que so sincroniza a cada 5 minutos (achado 40).
export function resolveEffectiveRoleCanon(
  user: AuthenticatedUser,
  access?: UserAccess
): string | null {
  if (access) return access.canonicalRole ?? access.role;
  return canonicalRoleName(user.role ?? null) ?? user.role ?? null;
}
