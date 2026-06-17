import { issueTokenPair, verifyRefreshToken } from "@/server/auth/api-token";
import { loadUserAccess } from "@/server/auth/access";
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
  const sub = await verifyRefreshToken(refreshToken);
  const access = await loadUserAccess(Number(sub));
  if (!access.exists) {
    return Response.json(
      { error: "Usuario inativo ou removido", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const tokens = await issueTokenPair({ sub, role: access.role ?? "profissional" });
  // Achado 74: devolve o papel/usuario EFETIVO (access fresco do banco) para o cliente
  // mobile atualizar a role persistida usada no roteamento, sem exigir novo login.
  return Response.json({
    ...tokens,
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
