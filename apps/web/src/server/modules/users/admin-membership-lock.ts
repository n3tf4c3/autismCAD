import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { users } from "@autismcad/db/schema";
import type { DbExecutor } from "@/server/db/transaction";
import { normalizeRoleForMatch } from "@/server/auth/permissions";
import { AppError } from "@/server/shared/errors";

// A mesma chave protege exclusao, rebaixamento e promocao, antes de qualquer leitura.
export async function lockAdminMembership(tx: DbExecutor, requesterUserId: number) {
  await tx.execute(sql`select pg_advisory_xact_lock(74812001)`);
  const [actor] = await tx.select({ role: users.role }).from(users)
    .where(and(eq(users.id, requesterUserId), eq(users.ativo, true), isNull(users.deletedAt))).limit(1);
  if (!actor || normalizeRoleForMatch(actor.role) !== "ADMIN_GERAL") {
    throw new AppError("Acesso restrito ao admin-geral ativo", 403, "FORBIDDEN");
  }
}
