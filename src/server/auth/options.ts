import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { db } from "@/db";
import { users } from "@/server/db/schema";
import { loginSchema } from "@/server/modules/auth/auth.schema";
import { verifyPassword } from "@/server/auth/password";

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
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

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
          .where(eq(users.email, parsed.data.email))
          .limit(1);

        if (!user || !user.ativo) return null;

        const passwordIsValid = await verifyPassword(
          parsed.data.password,
          user.senhaHash
        );
        if (!passwordIsValid) return null;

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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = String(token.role ?? "terapeuta");
      }
      return session;
    },
  },
};
