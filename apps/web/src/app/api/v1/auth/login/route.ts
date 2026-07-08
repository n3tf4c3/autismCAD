import { verifyCredentials } from "@/server/auth/credentials";
import { issueTokenPair } from "@/server/auth/api-token";
import {
  deleteExpiredRefreshTokens,
  registerRefreshToken,
} from "@/server/auth/refresh-token-store";
import { isPolicyConsentRequired } from "@/server/modules/consent/consent.service";
import { withErrorHandlingNoContext } from "@/server/shared/http";

export const runtime = "nodejs";

function headersToObject(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

export const POST = withErrorHandlingNoContext(async (request: Request) => {
  const body = await request.json().catch(() => null);
  const credentials =
    body && typeof body === "object" ? (body as Record<string, unknown>) : undefined;

  const user = await verifyCredentials(credentials, headersToObject(request.headers));
  if (!user) {
    return Response.json(
      { error: "Credenciais invalidas", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const issued = await issueTokenPair({
    sub: String(user.id),
    role: user.role,
    tokenVersion: user.tokenVersion,
  });
  // Achado 80: registra o refresh token no store (revogavel) e aproveita para limpar
  // registros ja expirados do usuario.
  await deleteExpiredRefreshTokens(user.id);
  await registerRefreshToken({
    userId: user.id,
    jti: issued.refreshJti,
    expiresAt: issued.refreshExpiresAt,
  });
  const consentRequired = await isPolicyConsentRequired(user.id);
  return Response.json({
    ...issued.tokens,
    user: {
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role,
      consentRequired,
    },
  });
});
