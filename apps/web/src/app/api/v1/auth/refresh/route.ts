import {
  issueTokenPair,
  verifyRefreshToken,
  type IssuedTokenPair,
} from "@/server/auth/api-token";
import { loadUserAccess } from "@/server/auth/access";
import {
  claimRefreshToken,
  registerRefreshToken,
} from "@/server/auth/refresh-token-store";
import { rotateRefreshTokenCore } from "@/server/auth/refresh-token-rotation-core";
import { runDbTransaction, type DbExecutor } from "@/server/db/transaction";
import { isCredentialVersionRevoked } from "@/server/auth/token-version";
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
  if (isCredentialVersionRevoked({ tokenVersion, currentVersion: access.tokenVersion })) {
    return Response.json(
      { error: "Sessao expirada, faca login novamente", code: "TOKEN_REVOKED" },
      { status: 401 }
    );
  }

  // Achado 80: tokens legados sem jti nao pertencem ao store e exigem novo login.
  if (!jti) {
    return Response.json(
      { error: "Sessao expirada, faca login novamente", code: "TOKEN_REVOKED" },
      { status: 401 }
    );
  }

  // Achado 80: claim do JTI antigo e INSERT do novo JTI compartilham a mesma
  // transacao obrigatoria. Se o registro novo falhar, o claim sofre rollback e o
  // cliente pode repetir com o refresh anterior.
  const issued = await rotateRefreshTokenCore<DbExecutor, IssuedTokenPair>({
    issue: () =>
      issueTokenPair({
        sub,
        role: access.role ?? "profissional",
        tokenVersion: access.tokenVersion,
      }),
    runTransaction: (fn) =>
      runDbTransaction(fn, {
        operation: "auth.rotateRefreshToken",
        mode: "required",
      }),
    claim: (tx) => claimRefreshToken({ userId: Number(sub), jti }, tx),
    register: (tx, next) =>
      registerRefreshToken(
        {
          userId: Number(sub),
          jti: next.refreshJti,
          expiresAt: next.refreshExpiresAt,
        },
        tx
      ),
  });
  if (!issued) {
    return Response.json(
      { error: "Sessao expirada, faca login novamente", code: "TOKEN_REVOKED" },
      { status: 401 }
    );
  }
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
