import { verifyRefreshToken } from "@/server/auth/api-token";
import { revokeRefreshToken } from "@/server/auth/refresh-token-store";
import { withErrorHandlingNoContext } from "@/server/shared/http";

export const runtime = "nodejs";

// Achado 80: revoga o refresh token apresentado (logout do mobile). Idempotente e sem
// vazamento de estado: token invalido/expirado/ja revogado tambem responde 204 — o
// logout local do cliente nunca falha por causa do servidor.
export const POST = withErrorHandlingNoContext(async (request: Request) => {
  const body = await request.json().catch(() => null);
  const refreshToken =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).refreshToken
      : null;

  if (typeof refreshToken === "string" && refreshToken) {
    try {
      const { jti } = await verifyRefreshToken(refreshToken);
      if (jti) await revokeRefreshToken(jti);
    } catch {
      // assinatura invalida ou token expirado: nada a revogar.
    }
  }
  return new Response(null, { status: 204 });
});
