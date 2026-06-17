import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@autismcad/db/schema";
import { loginSchema } from "@autismcad/validators/auth/auth.schema";
import {
  hashPassword,
  isLegacyPasswordHash,
  verifyPassword,
} from "@/server/auth/password";
import {
  isLoginRateLimited,
  recordLoginAttemptAccess,
} from "@/server/modules/access-logs/access-logs.service";

export type VerifiedUser = {
  id: number;
  nome: string;
  email: string;
  role: string;
  tokenVersion: number;
};

function normalizeAttemptEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().slice(0, 160);
  return email || null;
}

async function safeRecordLoginAttempt(params: {
  userId?: number | null;
  userEmail?: string | null;
  status: "SUCESSO" | "FALHA";
  headers?: Record<string, unknown>;
}) {
  try {
    await recordLoginAttemptAccess(params);
  } catch (error) {
    // Login must keep working even if audit logging fails.
    console.error("Falha ao registrar log de acesso", error);
  }
}

// Fonte unica de verificacao de credenciais, usada tanto pelo NextAuth (web/cookie)
// quanto pela API por token (mobile). Mantem o caminho critico de login sem divergencia:
// rate limit (achado 60) -> lookup de usuario ativo -> bcrypt -> upgrade de hash legado
// -> registro em access_logs. Resposta uniforme (null) para qualquer falha.
export async function verifyCredentials(
  credentials: Record<string, unknown> | undefined,
  headers?: Record<string, unknown>
): Promise<VerifiedUser | null> {
  const attemptEmail = normalizeAttemptEmail(credentials?.email);

  const parsed = loginSchema.safeParse(credentials);
  if (!parsed.success) {
    await safeRecordLoginAttempt({ userEmail: attemptEmail, status: "FALHA", headers });
    return null;
  }

  // Achado 60: bloqueia brute force/credential stuffing antes da busca do usuario e do
  // bcrypt. Resposta uniforme (null), igual a senha invalida.
  if (await isLoginRateLimited({ userEmail: parsed.data.email, headers })) {
    await safeRecordLoginAttempt({ userEmail: parsed.data.email, status: "FALHA", headers });
    return null;
  }

  const [user] = await db
    .select({
      id: users.id,
      nome: users.nome,
      email: users.email,
      senhaHash: users.senhaHash,
      role: users.role,
      ativo: users.ativo,
      tokenVersion: users.tokenVersion,
    })
    .from(users)
    .where(
      and(
        eq(users.email, parsed.data.email),
        eq(users.ativo, true),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  if (!user || !user.ativo) {
    await safeRecordLoginAttempt({ userEmail: parsed.data.email, status: "FALHA", headers });
    return null;
  }

  const passwordIsValid = await verifyPassword(parsed.data.password, user.senhaHash);
  if (!passwordIsValid) {
    await safeRecordLoginAttempt({
      userId: user.id,
      userEmail: user.email,
      status: "FALHA",
      headers,
    });
    return null;
  }

  if (isLegacyPasswordHash(user.senhaHash)) {
    try {
      const senhaHash = await hashPassword(parsed.data.password);
      await db
        .update(users)
        .set({ senhaHash, updatedAt: sql`now()` })
        .where(eq(users.id, user.id));
    } catch (error) {
      // Login should not fail when legacy hash upgrade fails.
      console.error("Falha ao migrar hash legado de senha", error);
    }
  }

  await safeRecordLoginAttempt({
    userId: user.id,
    userEmail: user.email,
    status: "SUCESSO",
    headers,
  });

  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  };
}
