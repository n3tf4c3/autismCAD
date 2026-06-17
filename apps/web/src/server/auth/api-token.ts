import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";
import { AppError } from "@/server/shared/errors";

// Tokens Bearer para clientes mobile (a sessao por cookie do NextAuth so serve browser).
// Assinados em HS256 com o mesmo AUTH_SECRET do NextAuth. Stateless (sem store de refresh)
// para o MVP: simples e serverless-safe; o custo e nao poder revogar antes de expirar.

const ISSUER = "autismcad";
const AUDIENCE = "autismcad-mobile";
const ACCESS_TTL = "1h";
const REFRESH_TTL = "30d";
export const ACCESS_TTL_SECONDS = 60 * 60;

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

export type ApiTokenPair = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
};

export async function issueTokenPair(payload: {
  sub: string;
  role: string;
  tokenVersion: number;
}): Promise<ApiTokenPair> {
  const key = secretKey();
  const base = (typ: "access" | "refresh") =>
    new SignJWT({ typ, ver: payload.tokenVersion })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(payload.sub)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt();

  const accessToken = await base("access")
    .setExpirationTime(ACCESS_TTL)
    .sign(key);
  const refreshToken = await base("refresh")
    .setExpirationTime(REFRESH_TTL)
    .sign(key);

  return { accessToken, refreshToken, tokenType: "Bearer", expiresIn: ACCESS_TTL_SECONDS };
}

export type VerifiedToken = {
  sub: string;
  // null quando o token foi emitido antes do claim 'ver' (tratado como versao 0).
  tokenVersion: number | null;
};

async function verify(
  token: string,
  expectedTyp: "access" | "refresh"
): Promise<VerifiedToken> {
  let sub: string | undefined;
  let typ: unknown;
  let ver: unknown;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    sub = payload.sub;
    typ = payload.typ;
    ver = payload.ver;
  } catch {
    throw new AppError("Token invalido ou expirado", 401, "UNAUTHORIZED");
  }
  if (typ !== expectedTyp || !sub) {
    throw new AppError("Token invalido", 401, "UNAUTHORIZED");
  }
  return { sub, tokenVersion: typeof ver === "number" ? ver : null };
}

export async function verifyAccessToken(token: string): Promise<VerifiedToken> {
  return verify(token, "access");
}

export async function verifyRefreshToken(token: string): Promise<VerifiedToken> {
  return verify(token, "refresh");
}
