import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { and, eq, isNull } from "drizzle-orm";
import { env } from "@/lib/env";
import { db } from "@/db";
import { users } from "@autismcad/db/schema";
import { verifyCredentials } from "@/server/auth/credentials";

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
        const user = await verifyCredentials(
          credentials as Record<string, unknown> | undefined,
          req?.headers
        );
        if (!user) return null;

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
