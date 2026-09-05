import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@autismcad/db/schema";
import { AppError } from "@/server/shared/errors";
import { getAuthSession } from "@/server/auth/session";
import { normalizeRoleForMatch } from "@/server/auth/permissions";
import { assertHasPermission, loadUserAccess } from "@/server/auth/access";
import { assertSessionNotRevoked } from "@/server/auth/token-version";
import { parseSessionUserId } from "@/server/auth/user-id";
import { isPolicyConsentRequired } from "@/server/modules/consent/consent.service";

export type AuthenticatedUser = {
  id: number;
  role?: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  // Achado 131: claim 'ver' da sessao; null em sessoes emitidas antes do claim existir.
  tokenVersion?: number | null;
};

async function requireSessionUser(): Promise<AuthenticatedUser> {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new AppError("Nao autenticado", 401, "UNAUTHORIZED");
  }
  const userId = parseSessionUserId(session.user.id);
  return { ...session.user, id: userId };
}

// Achado 131: a troca de senha incrementa users.token_version. A sessao de cookie da web
// so segue valida enquanto o claim 'ver' bater com a coluna — mesma regra do Bearer mobile.
// Conferido nos guards que ja carregam a versao atual, sem consulta extra ao banco.
function assertSessionCurrent(user: AuthenticatedUser, currentVersion: number): void {
  assertSessionNotRevoked({ tokenVersion: user.tokenVersion ?? null, currentVersion });
}

async function assertPolicyConsent(userId: number): Promise<void> {
  if (await isPolicyConsentRequired(userId)) {
    throw new AppError("Consentimento da Politica de Privacidade pendente", 403, "CONSENT_REQUIRED");
  }
}

export async function requireUser(options?: { skipConsentGate?: boolean }): Promise<AuthenticatedUser> {
  const user = await requireSessionUser();
  const [activeUser] = await db
    .select({ id: users.id, tokenVersion: users.tokenVersion })
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
  assertSessionCurrent(user, activeUser.tokenVersion);
  if (!options?.skipConsentGate) await assertPolicyConsent(user.id);
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
  assertSessionCurrent(user, access.tokenVersion);
  const isAdminGeral = (access.canonicalRole ?? access.role) === "ADMIN_GERAL";
  if (!isAdminGeral) {
    throw new AppError("Acesso restrito ao admin-geral", 403, "FORBIDDEN");
  }
  await assertPolicyConsent(user.id);
  return { user, access };
}

export async function requirePermission(permissionKey: string | string[]) {
  const user = await requireSessionUser();
  const access = await loadUserAccess(user.id);
  if (!access.exists) {
    throw new AppError("Usuario inativo ou removido", 401, "UNAUTHORIZED");
  }
  assertSessionCurrent(user, access.tokenVersion);
  const keys = Array.isArray(permissionKey) ? permissionKey : [permissionKey];
  assertHasPermission(access, keys);
  await assertPolicyConsent(user.id);
  return { user, access };
}
