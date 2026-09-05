import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@autismcad/db/schema";
import { AppError } from "@/server/shared/errors";
import {
  CURRENT_PRIVACY_POLICY_VERSION,
  isPolicyConsentAccepted,
} from "@autismcad/shared/policy";

// Consentimento LGPD da Política de Privacidade. Fonte única usada pelo guard da web
// (layout protegido) e pela API por token (mobile).
export async function isPolicyConsentRequired(userId: number): Promise<boolean> {
  const [row] = await db
    .select({ versao: users.politicaVersaoAceita })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return false; // usuário inexistente: o guard de auth trata o 401/redirect
  return !isPolicyConsentAccepted(row.versao);
}

export async function acceptCurrentPolicy(userId: number, tokenVersion: number): Promise<void> {
  const [accepted] = await db
    .update(users)
    .set({
      politicaVersaoAceita: CURRENT_PRIVACY_POLICY_VERSION,
      politicaAceitaEm: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, userId), eq(users.ativo, true), isNull(users.deletedAt), eq(users.tokenVersion, tokenVersion)))
    .returning({ id: users.id });
  if (!accepted) throw new AppError("Sessao revogada ou usuario inativo", 401, "TOKEN_REVOKED");
}
