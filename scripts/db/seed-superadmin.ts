import { config } from "dotenv";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { roles, users } from "../../src/server/db/schema";

config({ path: ".env.local" });
config({ path: ".env" });

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

  const email = readEnv("SEED_SUPERADMIN_EMAIL") ?? readEnv("ADMIN_SEED_EMAIL");
  const password =
    readEnv("SEED_SUPERADMIN_PASSWORD") ?? readEnv("ADMIN_SEED_PASSWORD");
  const nome =
    readEnv("SEED_SUPERADMIN_NAME") ?? readEnv("ADMIN_SEED_NAME") ?? "Super Admin";

  if (!email || !password) {
    throw new Error(
      "Defina SEED_SUPERADMIN_EMAIL/SEED_SUPERADMIN_PASSWORD ou ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD."
    );
  }

  const sql = neon(databaseUrl);
  const db = drizzle({ client: sql });
  const senhaHash = await hash(password, Number(process.env.BCRYPT_COST ?? 12));

  await db
    .insert(roles)
    .values([
      { slug: "admin-geral", nome: "Administrador Geral" },
      { slug: "admin", nome: "Administrador" },
      { slug: "terapeuta", nome: "Terapeuta" },
      { slug: "recepcao", nome: "Recepcao" },
    ])
    .onConflictDoNothing();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({
        nome,
        senhaHash,
        role: "admin-geral",
        ativo: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
    console.log(`Super admin atualizado: ${email}`);
    return;
  }

  await db.insert(users).values({
    nome,
    email,
    senhaHash,
    role: "admin-geral",
    ativo: true,
  });

  console.log(`Super admin criado: ${email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
