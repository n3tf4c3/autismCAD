import "server-only";
import {
  assertHasPermission,
  loadUserAccess,
  type UserAccess,
} from "@/server/auth/access";
import type { AuthenticatedUser } from "@/server/auth/auth";
import { verifyAccessToken } from "@/server/auth/api-token";
import { isMobileTokenRevoked } from "@/server/auth/token-version";
import { consentGateBlocks } from "@/server/modules/consent/consent-gate";
import { isPolicyConsentRequired } from "@/server/modules/consent/consent.service";
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
  request: Request,
  options?: { skipConsentGate?: boolean }
): Promise<{ user: AuthenticatedUser; access: UserAccess }> {
  const token = bearerToken(request);
  if (!token) throw new AppError("Nao autenticado", 401, "UNAUTHORIZED");

  const { sub, tokenVersion } = await verifyAccessToken(token);
  const access = await loadUserAccess(Number(sub));
  if (!access.exists || !access.user) {
    throw new AppError("Usuario inativo ou removido", 401, "UNAUTHORIZED");
  }

  // Achado 103: access token emitido antes da ultima troca de senha foi revogado.
  if (isMobileTokenRevoked({ tokenVersion, currentVersion: access.tokenVersion })) {
    throw new AppError("Sessao expirada, faca login novamente", 401, "TOKEN_REVOKED");
  }

  // Achado 122: impoe o consentimento LGPD no servidor (paridade com o layout protegido
  // da web). Rotas que precisam funcionar sem consentimento (aceitar a politica) passam
  // skipConsentGate; nesse caso nem consulta o banco.
  const skipConsentGate = options?.skipConsentGate ?? false;
  const consentRequired = skipConsentGate
    ? false
    : await isPolicyConsentRequired(access.user.id);
  if (consentGateBlocks({ consentRequired, skipConsentGate })) {
    throw new AppError(
      "Consentimento da Politica de Privacidade pendente",
      403,
      "CONSENT_REQUIRED"
    );
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
