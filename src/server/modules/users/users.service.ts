import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  isNotNull,
  ne,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import { hashPassword } from "@/server/auth/password";
import {
  pacientes,
  permissions,
  rolePermissions,
  roles,
  userPacienteVinculos,
  users,
} from "@/server/db/schema";
import {
  CreateUserInput,
  UpdateRolePermissionsInput,
  UpdateUserInput,
} from "@/server/modules/users/users.schema";
import { runDbTransaction } from "@/server/db/transaction";
import { canonicalRoleName } from "@/server/auth/permissions";
import { AppError } from "@/server/shared/errors";

function isResponsavelRole(roleName: string): boolean {
  return (canonicalRoleName(roleName) ?? roleName) === "RESPONSAVEL";
}

async function assertPacienteVinculoValido(pacienteId: number) {
  if (!Number.isFinite(pacienteId) || pacienteId <= 0) {
    throw new AppError("Paciente vinculado invalido", 400, "INVALID_INPUT");
  }
  const [row] = await db
    .select({ id: pacientes.id })
    .from(pacientes)
    .where(and(eq(pacientes.id, pacienteId), isNull(pacientes.deletedAt)))
    .limit(1);
  if (!row) {
    throw new AppError("Paciente vinculado nao encontrado", 404, "NOT_FOUND");
  }
}

export async function listUsers() {
  return db
    .select({
      id: users.id,
      nome: users.nome,
      email: users.email,
      role: users.role,
      created_at: users.createdAt,
      pacienteIdVinculado: userPacienteVinculos.pacienteId,
      pacienteNomeVinculado: pacientes.nome,
    })
    .from(users)
    .leftJoin(userPacienteVinculos, eq(userPacienteVinculos.userId, users.id))
    .leftJoin(
      pacientes,
      and(eq(pacientes.id, userPacienteVinculos.pacienteId), isNull(pacientes.deletedAt))
    )
    .where(and(eq(users.ativo, true), isNull(users.deletedAt)))
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

  const pacienteIdVinculado =
    input.pacienteIdVinculado == null ? null : Number(input.pacienteIdVinculado);
  if (isResponsavelRole(roleName)) {
    if (!pacienteIdVinculado) {
      throw new AppError(
        "Perfil responsavel exige paciente vinculado",
        400,
        "INVALID_INPUT"
      );
    }
    await assertPacienteVinculoValido(pacienteIdVinculado);
  }

  const senhaHash = await hashPassword(input.senha);
  try {
    let saved:
      | {
          id: number;
          email: string;
          role: string;
        }
      | undefined;
    await runDbTransaction(
      async (tx) => {
        [saved] = await tx
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
        if (!saved) return;
        if (isResponsavelRole(roleName) && pacienteIdVinculado) {
          await tx
            .insert(userPacienteVinculos)
            .values({
              userId: saved.id,
              pacienteId: pacienteIdVinculado,
            })
            .onConflictDoUpdate({
              target: userPacienteVinculos.userId,
              set: {
                pacienteId: pacienteIdVinculado,
                updatedAt: sql`now()`,
              },
            });
        }
      },
      { operation: "users.createUser", mode: "required" }
    );
    if (!saved) {
      throw new AppError("Falha ao criar usuario", 500, "INTERNAL_ERROR");
    }

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

  const pacienteIdVinculado =
    input.pacienteIdVinculado == null ? null : Number(input.pacienteIdVinculado);
  if (isResponsavelRole(roleName)) {
    if (!pacienteIdVinculado) {
      throw new AppError(
        "Perfil responsavel exige paciente vinculado",
        400,
        "INVALID_INPUT"
      );
    }
    await assertPacienteVinculoValido(pacienteIdVinculado);
  }

  const senha = input.senha?.trim();
  const setData = {
    nome: input.nome.trim(),
    email: input.email.trim(),
    role: roleName,
    updatedAt: sql`now()`,
    ...(senha ? { senhaHash: await hashPassword(senha) } : {}),
  };

  await runDbTransaction(
    async (tx) => {
      const [updated] = await tx
        .update(users)
        .set(setData)
        .where(and(eq(users.id, id), isNull(users.deletedAt)))
        .returning({ id: users.id });
      if (!updated) {
        throw new AppError("Usuario nao encontrado", 404, "NOT_FOUND");
      }
      if (isResponsavelRole(roleName) && pacienteIdVinculado) {
        await tx
          .insert(userPacienteVinculos)
          .values({
            userId: id,
            pacienteId: pacienteIdVinculado,
          })
          .onConflictDoUpdate({
            target: userPacienteVinculos.userId,
            set: {
              pacienteId: pacienteIdVinculado,
              updatedAt: sql`now()`,
            },
          });
      } else {
        await tx.delete(userPacienteVinculos).where(eq(userPacienteVinculos.userId, id));
      }
    },
    { operation: "users.updateUser", mode: "required" }
  );

  return {
    ok: true,
    id,
    email: input.email.trim(),
    role: roleName,
    pacienteIdVinculado: isResponsavelRole(roleName) ? pacienteIdVinculado : null,
  };
}

export async function deleteUser(id: number, requesterUserId: number) {
  if (id === requesterUserId) {
    throw new AppError("Nao e possivel excluir o proprio usuario", 400, "SELF_DELETE");
  }
  const [deleted] = await db
    .update(users)
    .set({
      ativo: false,
      deletedAt: sql`now()`,
      deletedByUserId: requesterUserId,
      updatedAt: sql`now()`,
    })
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .returning({ id: users.id });
  if (!deleted) {
    throw new AppError("Usuario nao encontrado", 404, "NOT_FOUND");
  }
  return { ok: true, id: deleted.id };
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
    .where(
      and(
        isNotNull(users.role),
        ne(users.role, ""),
        eq(users.ativo, true),
        isNull(users.deletedAt)
      )
    );

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

  await runDbTransaction(
    async (tx) => {
      await tx.delete(rolePermissions).where(eq(rolePermissions.role, roleName));
      if (permissionIds.length) {
        await tx
          .insert(rolePermissions)
          .values(permissionIds.map((permissionId) => ({ role: roleName, permissionId })));
      }
    },
    { operation: "users.updateRolePermissions", mode: "required" }
  );

  return {
    ok: true,
    role: roleName,
    permissions: permissionIds,
  };
}
