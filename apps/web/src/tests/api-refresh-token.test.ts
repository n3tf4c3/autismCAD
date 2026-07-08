import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";

import {
  issueTokenPairCore,
  verifyTokenCore,
  REFRESH_TTL_SECONDS,
} from "@/server/auth/api-token-core";

// Achado 80: todo refresh token emitido carrega um jti registrado no store
// (api_refresh_tokens); o refresh so aceita tokens cujo jti ainda esta valido no store.
// Tokens legados (sem jti) resultam em jti null e a rota de refresh rejeita com 401.

const SECRET = "segredo-de-teste-com-tamanho-suficiente";

test("refresh token emitido carrega jti e a verificacao o devolve", async () => {
  const issued = await issueTokenPairCore(SECRET, {
    sub: "42",
    role: "profissional",
    tokenVersion: 1,
  });
  assert.ok(issued.refreshJti.length > 0);

  const verified = await verifyTokenCore(SECRET, issued.tokens.refreshToken, "refresh");
  assert.equal(verified.sub, "42");
  assert.equal(verified.tokenVersion, 1);
  assert.equal(verified.jti, issued.refreshJti);
});

test("refresh tokens emitidos em sequencia tem jti distintos (rotacao rastreavel)", async () => {
  const a = await issueTokenPairCore(SECRET, { sub: "1", role: "x", tokenVersion: 0 });
  const b = await issueTokenPairCore(SECRET, { sub: "1", role: "x", tokenVersion: 0 });
  assert.notEqual(a.refreshJti, b.refreshJti);
});

test("expiracao registrada no store acompanha o TTL do refresh token", async () => {
  const before = Date.now();
  const issued = await issueTokenPairCore(SECRET, { sub: "1", role: "x", tokenVersion: 0 });
  const delta = issued.refreshExpiresAt.getTime() - before;
  assert.ok(Math.abs(delta - REFRESH_TTL_SECONDS * 1000) < 5000);
});

test("refresh token legado (sem jti) verifica com jti null — rota rejeita", async () => {
  // Reproduz um token emitido pela versao anterior de api-token.ts (sem claim jti).
  const legacy = await new SignJWT({ typ: "refresh", ver: 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("42")
    .setIssuer("autismcad")
    .setAudience("autismcad-mobile")
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(SECRET));

  const verified = await verifyTokenCore(SECRET, legacy, "refresh");
  assert.equal(verified.jti, null);
});

test("access token nao passa na verificacao de refresh (typ)", async () => {
  const issued = await issueTokenPairCore(SECRET, { sub: "42", role: "x", tokenVersion: 0 });
  await assert.rejects(
    verifyTokenCore(SECRET, issued.tokens.accessToken, "refresh"),
    (error: unknown) =>
      error instanceof Error && error.message === "Token invalido"
  );
});
