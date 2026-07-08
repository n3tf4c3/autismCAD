import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiRefreshTokens } from "@autismcad/db/schema";

// Achado 80: store dos refresh tokens mobile (tabela api_refresh_tokens). Guarda apenas
// o jti — o JWT continua assinado, entao vazamento do banco nao permite forjar token;
// o store so decide se um token emitido ainda vale (rotacao no refresh, revogacao no logout).

export async function registerRefreshToken(params: {
  userId: number;
  jti: string;
  expiresAt: Date;
}): Promise<void> {
  await db.insert(apiRefreshTokens).values({
    userId: params.userId,
    jti: params.jti,
    expiresAt: params.expiresAt,
  });
}

// Rotacao atomica: revoga o token SE ele ainda estava valido, num unico UPDATE — dois
// refreshes concorrentes com o mesmo token nao conseguem ambos rotacionar (o segundo
// recebe false e o cliente refaz login). Retorna false para jti desconhecido (inclui
// tokens legados sem registro), ja revogado ou expirado.
export async function claimRefreshToken(params: {
  userId: number;
  jti: string;
}): Promise<boolean> {
  const rows = await db
    .update(apiRefreshTokens)
    .set({ revokedAt: sql`now()` })
    .where(
      and(
        eq(apiRefreshTokens.jti, params.jti),
        eq(apiRefreshTokens.userId, params.userId),
        isNull(apiRefreshTokens.revokedAt),
        sql`${apiRefreshTokens.expiresAt} > now()`
      )
    )
    .returning({ id: apiRefreshTokens.id });
  return rows.length > 0;
}

// Logout: revogacao idempotente do token apresentado.
export async function revokeRefreshToken(jti: string): Promise<void> {
  await db
    .update(apiRefreshTokens)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(apiRefreshTokens.jti, jti), isNull(apiRefreshTokens.revokedAt)));
}

// Limpeza oportunista (chamada no login): remove registros ja expirados do usuario,
// evitando crescimento sem limite da tabela.
export async function deleteExpiredRefreshTokens(userId: number): Promise<void> {
  await db
    .delete(apiRefreshTokens)
    .where(
      and(eq(apiRefreshTokens.userId, userId), sql`${apiRefreshTokens.expiresAt} <= now()`)
    );
}
