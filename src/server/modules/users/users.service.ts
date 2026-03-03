import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  ne,
} from "drizzle-orm";
import { db } from "@/db";
import { hashPassword } from "@/server/auth/password";
import {
  permissions,
  rolePermissions,
  roles,
  users,
} from "@/server/db/schema";
import {
  CreateUserInput,
  UpdateRolePermissionsInput,
  UpdateUserInput,
} from "@/server/modules/users/users.schema";
import { AppError } from "@/server/shared/errors";

export async function listUsers() {
  return db
    .select({
      id: users.id,
      nome: users.nome,
      email: users.email,
      role: users.role,
      created_at: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt), asc(users.nome));
}

export async function createUser(input: CreateUserInput) {
  const roleName = input.role.trim();
  const [roleRow] = await db
    .select({ slug: roles.slug })
    .from(roles)
    .where(eq(roles.slug, roleName))
    .limit(1);
  if (!roleRow) {
    throw new AppError("Role invalida", 400, "INVALID_ROLE");
  }

  const senhaHash = await hashPassword(input.senha);
  try {
    const [saved] = await db
      .insert(users)
      .values({
        nome: input.nome.trim(),
        email: input.email.trim(),
        senhaHash,
        role: roleName,
        ativo: true,
      })
      .returning({
        id: users.id,
        email: users.email,
        role: users.role,
      });

    return saved;
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === "23505" || String(err.message ?? "").includes("unique")) {
      throw new AppError("Email ja cadastrado", 409, "CONFLICT");
    }
    throw error;
  }
}

export async function updateUser(id: number, input: UpdateUserInput) {
  const roleName = input.role.trim();
  const [roleRow] = await db
    .select({ slug: roles.slug })
    .from(roles)
    .where(eq(roles.slug, roleName))
    .limit(1);
  if (!roleRow) {
    throw new AppError("Role invalida", 400, "INVALID_ROLE");
  }

  const setData: Partial<typeof users.$inferInsert> = {
    nome: input.nome.trim(),
    email: input.email.trim(),
    role: roleName,
    updatedAt: new Date(),
  };
  if (input.senha?.trim()) {
    setData.senhaHash = await hashPassword(input.senha.trim());
  }

  await db.update(users).set(setData).where(eq(users.id, id));

  return {
    ok: true,
    id,
    email: input.email.trim(),
    role: roleName,
  };
}

export async function deleteUser(id: number, requesterUserId: number) {
  if (id === requesterUserId) {
    throw new AppError("Nao e possivel excluir o proprio usuario", 400, "SELF_DELETE");
  }
  const [updated] = await db
    .update(users)
    .set({
      ativo: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning({ id: users.id });

  if (!updated) {
    throw new AppError("Usuario nao encontrado", 404, "NOT_FOUND");
  }

  return { ok: true, id: updated.id };
}

export async function listPermissions() {
  return db
    .select({
      id: permissions.id,
      resource: permissions.resource,
      action: permissions.action,
    })
    .from(permissions)
    .orderBy(asc(permissions.resource), asc(permissions.action));
}

export async function listRoles() {
  const baseRoles = await db
    .select({ nome: roles.slug })
    .from(roles)
    .orderBy(asc(roles.slug));
  const userRoles = await db
    .select({ nome: users.role })
    .from(users)
    .where(and(isNotNull(users.role), ne(users.role, "")));

  const roleNames = new Set<string>();
  baseRoles.forEach((item) => roleNames.add(item.nome));
  userRoles.forEach((item) => roleNames.add(item.nome));

  return Array.from(roleNames)
    .sort((a, b) => a.localeCompare(b))
    .map((nome) => ({ nome }));
}

export async function getRolePermissions(roleName: string) {
  const permissionRows = await db
    .select({
      id: permissions.id,
      resource: permissions.resource,
      action: permissions.action,
    })
    .from(rolePermissions)
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(rolePermissions.role, roleName))
    .orderBy(asc(permissions.resource), asc(permissions.action));

  return {
    role: { nome: roleName },
    permissions: permissionRows,
  };
}

export async function updateRolePermissions(
  roleName: string,
  payload: UpdateRolePermissionsInput
) {
  let permissionIds = payload.permissions;
  if (roleName === "admin-geral") {
    const all = await db.select({ id: permissions.id }).from(permissions);
    permissionIds = all.map((item) => item.id);
  } else if (permissionIds.length) {
    const valid = await db
      .select({ id: permissions.id })
      .from(permissions)
      .where(inArray(permissions.id, permissionIds));
    permissionIds = valid.map((item) => item.id);
  }

  await db.delete(rolePermissions).where(eq(rolePermissions.role, roleName));
  if (permissionIds.length) {
    await db
      .insert(rolePermissions)
      .values(permissionIds.map((permissionId) => ({ role: roleName, permissionId })));
  }

  return {
    ok: true,
    role: roleName,
    permissions: permissionIds,
  };
}
