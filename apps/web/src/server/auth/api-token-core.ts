import { SignJWT, jwtVerify } from "jose";
import { AppError } from "@autismcad/shared/errors";

// Nucleo puro da emissao/verificacao dos tokens Bearer mobile (sem "server-only"/env,
// o segredo e injetado), para ser testavel em node:test. O binding com AUTH_SECRET
// vive em api-token.ts.

const ISSUER = "autismcad";
const AUDIENCE = "autismcad-mobile";
const ACCESS_TTL = "1h";
const REFRESH_TTL = "30d";
export const ACCESS_TTL_SECONDS = 60 * 60;
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export type ApiTokenPair = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
};

export type IssuedTokenPair = {
  tokens: ApiTokenPair;
  // Achado 80: identificador do refresh token, registrado no store para rotacao/revogacao.
  refreshJti: string;
  refreshExpiresAt: Date;
};

export async function issueTokenPairCore(
  secret: string,
  payload: {
    sub: string;
    role: string;
    tokenVersion: number;
  }
): Promise<IssuedTokenPair> {
  const key = secretKey(secret);
  const refreshJti = crypto.randomUUID();
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
    .setJti(refreshJti)
    .setExpirationTime(REFRESH_TTL)
    .sign(key);

  return {
    tokens: { accessToken, refreshToken, tokenType: "Bearer", expiresIn: ACCESS_TTL_SECONDS },
    refreshJti,
    refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
  };
}

export type VerifiedToken = {
  sub: string;
  // null quando o token foi emitido antes do claim 'ver' (tratado como versao 0).
  tokenVersion: number | null;
  // Achado 80: null quando o refresh token foi emitido antes do store (legado) — o
  // refresh rejeita, exigindo novo login. Access tokens nao carregam jti.
  jti: string | null;
};

export async function verifyTokenCore(
  secret: string,
  token: string,
  expectedTyp: "access" | "refresh"
): Promise<VerifiedToken> {
  let sub: string | undefined;
  let typ: unknown;
  let ver: unknown;
  let jti: unknown;
  try {
    const { payload } = await jwtVerify(token, secretKey(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    sub = payload.sub;
    typ = payload.typ;
    ver = payload.ver;
    jti = payload.jti;
  } catch {
    throw new AppError("Token invalido ou expirado", 401, "UNAUTHORIZED");
  }
  if (typ !== expectedTyp || !sub) {
    throw new AppError("Token invalido", 401, "UNAUTHORIZED");
  }
  return {
    sub,
    tokenVersion: typeof ver === "number" ? ver : null,
    jti: typeof jti === "string" && jti ? jti : null,
  };
}
