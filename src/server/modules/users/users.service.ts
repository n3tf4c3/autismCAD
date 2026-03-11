import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
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

function normalizePacienteIdsFromInput(input: {
  pacienteIdVinculado?: number | null;
  pacienteIdsVinculados?: number[] | null;
}): number[] {
  const ids: number[] = [];
  if (Array.isArray(input.pacienteIdsVinculados)) {
    ids.push(...input.pacienteIdsVinculados.map((id) => Number(id)));
  }
  if (input.pacienteIdVinculado != null) {
    ids.push(Number(input.pacienteIdVinculado));
  }
  const uniq = new Set<number>();
  ids.forEach((id) => {
    if (Number.isFinite(id) && id > 0) uniq.add(id);
  });
  return Array.from(uniq.values());
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
  const rows = await db
    .select({
      id: users.id,
      nome: users.nome,
      email: users.email,
      role: users.role,
      created_at: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.ativo, true), isNull(users.deletedAt)))
    .orderBy(desc(users.createdAt), asc(users.nome));

  if (!rows.length) return [];

  const userIds = rows.map((row) => row.id);
  const vinculosRows = await db
    .select({
      userId: userPacienteVinculos.userId,
      pacienteId: userPacienteVinculos.pacienteId,
      pacienteNome: pacientes.nome,
    })
    .from(userPacienteVinculos)
    .leftJoin(
      pacientes,
      and(eq(pacientes.id, userPacienteVinculos.pacienteId), isNull(pacientes.deletedAt))
    )
    .where(inArray(userPacienteVinculos.userId, userIds))
    .orderBy(asc(pacientes.nome), asc(userPacienteVinculos.pacienteId));

  const vinculosMap = new Map<number, Array<{ id: number; nome: string | null }>>();
  vinculosRows.forEach((row) => {
    const key = Number(row.userId);
    const current = vinculosMap.get(key) ?? [];
    if (!current.some((item) => item.id === Number(row.pacienteId))) {
      current.push({
        id: Number(row.pacienteId),
        nome: row.pacienteNome ?? null,
      });
      vinculosMap.set(key, current);
    }
  });

  return rows.map((row) => {
    const vinculos = vinculosMap.get(Number(row.id)) ?? [];
    const first = vinculos[0] ?? null;
    return {
      ...row,
      pacienteIdVinculado: first?.id ?? null,
      pacienteNomeVinculado: first?.nome ?? null,
      pacienteIdsVinculados: vinculos.map((item) => item.id),
      pacientesVinculados: vinculos,
    };
  });
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

  const pacienteIdsVinculados = normalizePacienteIdsFromInput({
    pacienteIdVinculado: input.pacienteIdVinculado,
    pacienteIdsVinculados: input.pacienteIdsVinculados,
  });
  if (isResponsavelRole(roleName)) {
    if (!pacienteIdsVinculados.length) {
      throw new AppError(
        "Perfil responsavel exige paciente vinculado",
        400,
        "INVALID_INPUT"
      );
    }
    for (const pacienteId of pacienteIdsVinculados) {
      await assertPacienteVinculoValido(pacienteId);
    }
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
        const savedUser = saved;
        if (!savedUser) return;
        if (isResponsavelRole(roleName) && pacienteIdsVinculados.length) {
          await tx
            .insert(userPacienteVinculos)
            .values(
              pacienteIdsVinculados.map((pacienteId) => ({
                userId: savedUser.id,
                pacienteId,
              }))
            )
            .onConflictDoNothing();
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

  const pacienteIdsVinculados = normalizePacienteIdsFromInput({
    pacienteIdVinculado: input.pacienteIdVinculado,
    pacienteIdsVinculados: input.pacienteIdsVinculados,
  });
  if (isResponsavelRole(roleName)) {
    if (!pacienteIdsVinculados.length) {
      throw new AppError(
        "Perfil responsavel exige paciente vinculado",
        400,
        "INVALID_INPUT"
      );
    }
    for (const pacienteId of pacienteIdsVinculados) {
      await assertPacienteVinculoValido(pacienteId);
    }
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
      if (isResponsavelRole(roleName) && pacienteIdsVinculados.length) {
        await tx.delete(userPacienteVinculos).where(eq(userPacienteVinculos.userId, id));
        await tx
          .insert(userPacienteVinculos)
          .values(
            pacienteIdsVinculados.map((pacienteId) => ({
              userId: id,
              pacienteId,
            }))
          )
          .onConflictDoNothing();
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
    pacienteIdVinculado: isResponsavelRole(roleName) ? (pacienteIdsVinculados[0] ?? null) : null,
    pacienteIdsVinculados: isResponsavelRole(roleName) ? pacienteIdsVinculados : [],
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
  // Reference catalog: permissions are not scoped by user active/deleted state.
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
  // Reference catalog: roles remain listable even when there are no active users.
  const baseRoles = await db
    .select({ nome: roles.slug })
    .from(roles)
    .orderBy(asc(roles.slug));
  return baseRoles;
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
