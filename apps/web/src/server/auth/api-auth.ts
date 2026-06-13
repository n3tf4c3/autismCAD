import "server-only";
import {
  assertHasPermission,
  loadUserAccess,
  type UserAccess,
} from "@/server/auth/access";
import type { AuthenticatedUser } from "@/server/auth/auth";
import { verifyAccessToken } from "@/server/auth/api-token";
import { AppError } from "@/server/shared/errors";

export function bearerToken(request: Request): string | null {
  const header =
    request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!/^Bearer$/i.test(scheme ?? "") || !token) return null;
  return token.trim() || null;
}

// Paralelo por token do requireUser/requirePermission de sessao (auth.ts). Deriva o usuario
// do access token Bearer, recarrega o acesso fresco do banco (loadUserAccess) e aplica as
// MESMAS regras de permissao (assertHasPermission) e de vinculo de paciente da web.
export async function requireApiUser(
  request: Request
): Promise<{ user: AuthenticatedUser; access: UserAccess }> {
  const token = bearerToken(request);
  if (!token) throw new AppError("Nao autenticado", 401, "UNAUTHORIZED");

  const sub = await verifyAccessToken(token);
  const access = await loadUserAccess(Number(sub));
  if (!access.exists || !access.user) {
    throw new AppError("Usuario inativo ou removido", 401, "UNAUTHORIZED");
  }

  const user: AuthenticatedUser = {
    id: access.user.id,
    role: access.role,
    name: access.user.nome,
    email: access.user.email,
  };
  return { user, access };
}

export async function requireApiPermission(
  request: Request,
  permissionKey: string | string[]
) {
  const { user, access } = await requireApiUser(request);
  const keys = Array.isArray(permissionKey) ? permissionKey : [permissionKey];
  assertHasPermission(access, keys);
  return { user, access };
}
