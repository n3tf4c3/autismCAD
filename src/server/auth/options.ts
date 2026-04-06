import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { and, eq, isNull, sql } from "drizzle-orm";
import { env } from "@/lib/env";
import { db } from "@/db";
import { users } from "@/server/db/schema";
import { loginSchema } from "@/server/modules/auth/auth.schema";
import {
  hashPassword,
  isLegacyPasswordHash,
  verifyPassword,
} from "@/server/auth/password";
import { recordLoginAttemptAccess } from "@/server/modules/access-logs/access-logs.service";

function normalizeAttemptEmail(credentials: Record<string, unknown> | undefined): string | null {
  const raw = credentials?.email;
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

const TOKEN_ROLE_SYNC_INTERVAL_SECONDS = 5 * 60;

async function refreshTokenRole(token: { sub?: string; role?: string; roleSyncedAt?: number }) {
  const sub = Number(token.sub ?? 0);
  if (!Number.isFinite(sub) || sub <= 0) return token;

  const nowSec = Math.floor(Date.now() / 1000);
  const lastSync = Number(token.roleSyncedAt ?? 0);
  if (Number.isFinite(lastSync) && nowSec - lastSync < TOKEN_ROLE_SYNC_INTERVAL_SECONDS) {
    return token;
  }

  try {
    const [currentUser] = await db
      .select({ role: users.role })
      .from(users)
      .where(and(eq(users.id, sub), eq(users.ativo, true), isNull(users.deletedAt)))
      .limit(1);

    token.role = currentUser?.role ?? token.role;
    token.roleSyncedAt = nowSec;
  } catch (error) {
    // Session refresh should not fail login flow on transient DB errors.
    console.error("Falha ao sincronizar role do token JWT", error);
  }

  return token;
}

export const authOptions: NextAuthOptions = {
  secret: env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const attemptEmail = normalizeAttemptEmail(
          credentials as Record<string, unknown> | undefined
        );

        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          await safeRecordLoginAttempt({
            userEmail: attemptEmail,
            status: "FALHA",
            headers: req?.headers,
          });
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
          await safeRecordLoginAttempt({
            userEmail: parsed.data.email,
            status: "FALHA",
            headers: req?.headers,
          });
          return null;
        }

        const passwordIsValid = await verifyPassword(
          parsed.data.password,
          user.senhaHash
        );
        if (!passwordIsValid) {
          await safeRecordLoginAttempt({
            userId: user.id,
            userEmail: user.email,
            status: "FALHA",
            headers: req?.headers,
          });
          return null;
        }

        if (isLegacyPasswordHash(user.senhaHash)) {
          try {
            const senhaHash = await hashPassword(parsed.data.password);
            await db
              .update(users)
              .set({
                senhaHash,
                updatedAt: sql`now()`,
              })
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
          headers: req?.headers,
        });

        return {
          id: String(user.id),
          name: user.nome,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.roleSyncedAt = Math.floor(Date.now() / 1000);
        return token;
      }
      return refreshTokenRole(token);
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = String(token.role ?? "profissional");
      }
      return session;
    },
  },
};
