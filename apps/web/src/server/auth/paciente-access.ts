import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { ADMIN_ROLES } from "@/server/auth/permissions";
import { loadUserAccess } from "@/server/auth/access";
import type { UserAccess } from "@/server/auth/access";
import { parseSessionUserId } from "@/server/auth/user-id";
import { AppError } from "@/server/shared/errors";
import { pacientes } from "@/server/db/schema";
import {
  obterProfissionalPorUsuario,
  profissionalAtendePaciente,
} from "@/server/modules/profissionais/profissionais.service";
import { getPacientesVinculadosByUserId } from "@/server/modules/pacientes/paciente-vinculos.service";

export type SessionUserLike = {
  id: number | string;
  role?: string | null;
};

function canReuseAccess(userId: number, access?: UserAccess): access is UserAccess {
  return !!access && access.exists && Number(access.user?.id) === userId;
}

export async function assertPacienteAccess(
  user: SessionUserLike,
  pacienteId: number,
  preloadedAccess?: UserAccess
) {
  const userId = parseSessionUserId(user.id);
  if (!Number.isFinite(pacienteId) || pacienteId <= 0) {
    throw new AppError("Paciente invalido", 400, "INVALID_INPUT");
  }

  const access = canReuseAccess(userId, preloadedAccess)
    ? preloadedAccess
    : await loadUserAccess(userId);
  if (!access.exists) {
    throw new AppError("Usuario nao encontrado", 401, "UNAUTHORIZED");
  }
  const [pacienteAtivo] = await db
    .select({ id: pacientes.id })
    .from(pacientes)
    .where(and(eq(pacientes.id, pacienteId), isNull(pacientes.deletedAt)))
    .limit(1);
  if (!pacienteAtivo) {
    throw new AppError("Paciente nao encontrado", 404, "NOT_FOUND");
  }

  const roleCanon = access.canonicalRole ?? access.role;
  const isAdmin = roleCanon ? ADMIN_ROLES.has(roleCanon) : false;
  if (isAdmin) {
    return {
      userId,
      access,
      profissionalId: null as number | null,
    };
  }

  const isResponsavel = roleCanon === "RESPONSAVEL";
  const isProfissional = roleCanon === "PROFISSIONAL";
  const isRecepcao = roleCanon === "RECEPCAO";
  if (isRecepcao) {
    return {
      userId,
      access,
      profissionalId: null as number | null,
    };
  }
  if (isProfissional) {
    const profissional = await obterProfissionalPorUsuario(userId);
    if (!profissional) {
      throw new AppError("Profissional sem vinculo", 403, "FORBIDDEN");
    } else {
      const vinculado = await profissionalAtendePaciente(pacienteId, profissional.id);
      if (vinculado) {
        return {
          userId,
          access,
          profissionalId: profissional.id,
        };
      }
      throw new AppError("Acesso negado ao paciente", 403, "FORBIDDEN");
    }
  }

  if (!isResponsavel) {
    throw new AppError("Acesso negado", 403, "FORBIDDEN");
  }

  const pacientesVinculados = await getPacientesVinculadosByUserId(userId);
  if (!pacientesVinculados.length) {
    throw new AppError("Responsavel sem paciente vinculado", 403, "FORBIDDEN");
  }
  const hasAccess = pacientesVinculados.some((paciente) => Number(paciente.id) === Number(pacienteId));
  if (!hasAccess) {
    throw new AppError("Acesso negado ao paciente", 403, "FORBIDDEN");
  }

  return {
    userId,
    access,
    profissionalId: null as number | null,
  };
}
