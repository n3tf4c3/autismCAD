import { config } from "dotenv";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import {
  permissions,
  terapias,
  rolePermissions,
  roles,
  users,
} from "../../src/server/db/schema";

config({ path: ".env.local" });
config({ path: ".env" });

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value || !value.trim()) return undefined;
  return value.trim();
}

const permissionSeeds = [
  { resource: "pacientes", action: "view" },
  { resource: "pacientes", action: "create" },
  { resource: "pacientes", action: "edit" },
  { resource: "pacientes", action: "delete" },
  { resource: "consultas", action: "view" },
  { resource: "consultas", action: "create" },
  { resource: "consultas", action: "edit" },
  { resource: "consultas", action: "cancel" },
  { resource: "consultas", action: "presence" },
  { resource: "consultas", action: "repasse_edit" },
  { resource: "prontuario", action: "view" },
  { resource: "prontuario", action: "create" },
  { resource: "prontuario", action: "version" },
  { resource: "prontuario", action: "finalize" },
  { resource: "prontuario", action: "pdf" },
  { resource: "evolucoes", action: "view" },
  { resource: "evolucoes", action: "create" },
  { resource: "evolucoes", action: "edit" },
  { resource: "evolucoes", action: "delete" },
  { resource: "relatorios", action: "view" },
  { resource: "relatorios", action: "export" },
  { resource: "relatorios_admin", action: "view" },
  { resource: "relatorios_admin", action: "export" },
  { resource: "relatorios_clinicos", action: "view" },
  { resource: "relatorios_clinicos", action: "export" },
  { resource: "terapeutas", action: "view" },
  { resource: "terapeutas", action: "create" },
  { resource: "terapeutas", action: "edit" },
  { resource: "terapeutas", action: "edit_self" },
  { resource: "terapeutas", action: "delete" },
  { resource: "configuracoes", action: "manage" },
  { resource: "atendimentos", action: "view" },
  { resource: "atendimentos", action: "create" },
  { resource: "atendimentos", action: "edit" },
  { resource: "atendimentos", action: "delete" },
  { resource: "prontuario", action: "delete" },
];

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

  await db
    .insert(permissions)
    .values(permissionSeeds)
    .onConflictDoNothing();

  await db
    .insert(terapias)
    .values([
      { nome: "Convencional" },
      { nome: "Intensiva" },
      { nome: "Especial" },
      { nome: "Intercambio" },
    ])
    .onConflictDoNothing();

  const allPermissions = await db
    .select({
      id: permissions.id,
      resource: permissions.resource,
      action: permissions.action,
    })
    .from(permissions);

  const permissionMap = new Map(
    allPermissions.map((item) => [`${item.resource}:${item.action}`, item.id])
  );
  const rolePermissionSeeds: Record<string, string[] | "ALL"> = {
    "admin-geral": "ALL",
    admin: "ALL",
    recepcao: [
      "pacientes:view",
      "pacientes:create",
      "pacientes:edit",
      "consultas:view",
      "consultas:create",
      "consultas:edit",
      "consultas:cancel",
      "consultas:presence",
      "consultas:repasse_edit",
      "relatorios_admin:view",
      "relatorios_admin:export",
      "terapeutas:view",
    ],
    terapeuta: [
      "pacientes:view",
      "consultas:view",
      "consultas:presence",
      "prontuario:view",
      "prontuario:create",
      "prontuario:version",
      "prontuario:finalize",
      "prontuario:pdf",
      "evolucoes:view",
      "evolucoes:create",
      "evolucoes:edit",
      "relatorios_clinicos:view",
      "relatorios_clinicos:export",
      "terapeutas:view",
      "terapeutas:edit_self",
    ],
  };

  for (const [roleName, list] of Object.entries(rolePermissionSeeds)) {
    const permissionIds =
      list === "ALL"
        ? allPermissions.map((item) => item.id)
        : list
            .map((key) => permissionMap.get(key))
            .filter((id): id is number => Number.isFinite(id));

    if (!permissionIds.length) continue;
    await db
      .insert(rolePermissions)
      .values(permissionIds.map((permissionId) => ({ role: roleName, permissionId })))
      .onConflictDoNothing();
  }

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
    console.log(`RBAC seed aplicado com ${allPermissions.length} permissoes.`);
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
  console.log(`RBAC seed aplicado com ${allPermissions.length} permissoes.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
