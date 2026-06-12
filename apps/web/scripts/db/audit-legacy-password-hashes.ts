import { config } from "dotenv";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { users } from "../../src/server/db/schema";

config({ path: ".env.local" });
config({ path: ".env" });

const LEGACY_SHA_REGEX = /^[a-f0-9]{64}$/i;

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value || !value.trim()) return undefined;
  return value.trim();
}

async function main() {
  const databaseUrl = readEnv("DATABASE_URL");
  if (!databaseUrl) {
    throw new Error("DATABASE_URL nao configurado.");
  }

  const sql = neon(databaseUrl);
  const db = drizzle({ client: sql });

  const rows = await db
    .select({
      id: users.id,
      nome: users.nome,
      email: users.email,
      role: users.role,
      senhaHash: users.senhaHash,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(and(eq(users.ativo, true), isNull(users.deletedAt)));

  const legacyUsers = rows
    .filter((row) => LEGACY_SHA_REGEX.test(String(row.senhaHash || "")))
    .map((row) => ({
      id: row.id,
      email: row.email,
      nome: row.nome,
      role: row.role,
      createdAt: row.createdAt ? String(row.createdAt) : null,
      updatedAt: row.updatedAt ? String(row.updatedAt) : null,
    }))
    .sort((a, b) => String(a.email || "").localeCompare(String(b.email || "")));

  if (!legacyUsers.length) {
    console.log("Nenhum usuario ativo com hash legado SHA-256.");
    return;
  }

  console.log(`Usuarios ativos com hash legado SHA-256: ${legacyUsers.length}`);
  console.table(legacyUsers);
  console.log("Acao recomendada: forcar reset de senha ou acompanhar migracao no proximo login.");
}
main().catch((error) => {
  console.error("Falha ao auditar hashes legados de senha.", error);
  process.exitCode = 1;
});
