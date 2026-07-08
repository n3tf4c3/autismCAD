import "server-only";
import { env } from "@/lib/env";
import {
  ACCESS_TTL_SECONDS,
  issueTokenPairCore,
  verifyTokenCore,
  type ApiTokenPair,
  type IssuedTokenPair,
  type VerifiedToken,
} from "@/server/auth/api-token-core";

// Tokens Bearer para clientes mobile (a sessao por cookie do NextAuth so serve browser).
// Assinados em HS256 com o mesmo AUTH_SECRET do NextAuth. Achado 80: cada refresh token
// carrega um jti registrado em api_refresh_tokens (refresh-token-store.ts), permitindo
// rotacao no refresh e revogacao individual no logout. A logica pura (assinatura/claims)
// vive em api-token-core.ts para ser testavel sem env.

export { ACCESS_TTL_SECONDS };
export type { ApiTokenPair, IssuedTokenPair, VerifiedToken };

export async function issueTokenPair(payload: {
  sub: string;
  role: string;
  tokenVersion: number;
}): Promise<IssuedTokenPair> {
  return issueTokenPairCore(env.AUTH_SECRET, payload);
}

export async function verifyAccessToken(token: string): Promise<VerifiedToken> {
  return verifyTokenCore(env.AUTH_SECRET, token, "access");
}

export async function verifyRefreshToken(token: string): Promise<VerifiedToken> {
  return verifyTokenCore(env.AUTH_SECRET, token, "refresh");
}
