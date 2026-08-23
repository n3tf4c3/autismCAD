import { sql } from "drizzle-orm";
import { users } from "@autismcad/db/schema";
import { assertRemoteWriteConfirmed } from "./_cleanup-safety";

export function assertSeedWriteConfirmed(
  databaseUrl: string,
  argv: readonly string[] = process.argv,
  env: Readonly<Record<string, string | undefined>> = process.env
): void {
  assertRemoteWriteConfirmed(databaseUrl, {
    argv,
    confirmationEnv: "SEED_CONFIRM",
    env,
    logPrefix: "seed-superadmin",
    operation: "Seed privilegiado",
  });
}

export function buildExistingSuperAdminUpdate(params: {
  nome: string;
  senhaHash: string;
  updatedAt?: Date;
}) {
  return {
    nome: params.nome,
    senhaHash: params.senhaHash,
    role: "admin-geral" as const,
    ativo: true,
    // Achado 135: a troca feita pelo seed revoga sessoes web/mobile anteriores.
    tokenVersion: sql`${users.tokenVersion} + 1`,
    updatedAt: params.updatedAt ?? new Date(),
  };
}
