import { issueTokenPair, verifyRefreshToken } from "@/server/auth/api-token";
import { loadUserAccess } from "@/server/auth/access";
import {
  claimRefreshToken,
  registerRefreshToken,
} from "@/server/auth/refresh-token-store";
import { isMobileTokenRevoked } from "@/server/auth/token-version";
import { withErrorHandlingNoContext } from "@/server/shared/http";

export const runtime = "nodejs";

export const POST = withErrorHandlingNoContext(async (request: Request) => {
  const body = await request.json().catch(() => null);
  const refreshToken =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).refreshToken
      : null;

  if (typeof refreshToken !== "string" || !refreshToken) {
    return Response.json(
      { error: "refreshToken obrigatorio", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  // Lanca AppError 401 (tratado por withErrorHandling) se invalido/expirado.
  const { sub, tokenVersion, jti } = await verifyRefreshToken(refreshToken);
  const access = await loadUserAccess(Number(sub));
  if (!access.exists) {
    return Response.json(
      { error: "Usuario inativo ou removido", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  // Achado 103: refresh token emitido antes da ultima troca de senha foi revogado.
  if (isMobileTokenRevoked({ tokenVersion, currentVersion: access.tokenVersion })) {
    return Response.json(
      { error: "Sessao expirada, faca login novamente", code: "TOKEN_REVOKED" },
      { status: 401 }
    );
  }

  // Achado 80: o refresh token precisa constar no store e ainda estar valido; o uso
  // rotaciona (revoga o apresentado). Tokens legados sem jti tambem caem aqui e exigem
  // novo login. O claim e atomico — refresh concorrente com o mesmo token nao duplica.
  const claimed = jti ? await claimRefreshToken({ userId: Number(sub), jti }) : false;
  if (!claimed) {
    return Response.json(
      { error: "Sessao expirada, faca login novamente", code: "TOKEN_REVOKED" },
      { status: 401 }
    );
  }

  const issued = await issueTokenPair({
    sub,
    role: access.role ?? "profissional",
    tokenVersion: access.tokenVersion,
  });
  await registerRefreshToken({
    userId: Number(sub),
    jti: issued.refreshJti,
    expiresAt: issued.refreshExpiresAt,
  });
  // Achado 74: devolve o papel/usuario EFETIVO (access fresco do banco) para o cliente
  // mobile atualizar a role persistida usada no roteamento, sem exigir novo login.
  return Response.json({
    ...issued.tokens,
    user: access.user
      ? {
          id: access.user.id,
          nome: access.user.nome,
          email: access.user.email,
          role: access.role ?? "profissional",
        }
      : null,
  });
});
