import { DefaultSession } from "next-auth";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      // Achado 131: versao de credencial embutida na sessao, conferida contra
      // users.token_version nos guards de servidor.
      tokenVersion: number | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    tokenVersion: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    roleSyncedAt?: number;
    ver?: number;
  }
}
