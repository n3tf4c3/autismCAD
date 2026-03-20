import "server-only";

import { canonicalRoleName, ADMIN_ROLES } from "@/server/auth/permissions";
import { loadUserAccess } from "@/server/auth/access";
import { AppError } from "@/server/shared/errors";
import {
  obterProfissionalPorUsuario,
  profissionalAtendePaciente,
} from "@/server/modules/profissionais/profissionais.service";
import { getPacientesVinculadosByUserId } from "@/server/modules/pacientes/paciente-vinculos.service";

export type SessionUserLike = {
  id: number | string;
  role?: string | null;
};

export async function assertPacienteAccess(user: SessionUserLike, pacienteId: number) {
  const userId = Number(user.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new AppError("Nao autenticado", 401, "UNAUTHORIZED");
  }
  if (!Number.isFinite(pacienteId) || pacienteId <= 0) {
    throw new AppError("Paciente invalido", 400, "INVALID_INPUT");
  }

  const access = await loadUserAccess(userId);
  if (!access.exists) {
    throw new AppError("Usuario nao encontrado", 401, "UNAUTHORIZED");
  }

  const isAdmin = access.roles.some((role) => ADMIN_ROLES.has(canonicalRoleName(role) ?? role));
  if (isAdmin) {
    return {
      userId,
      access,
      profissionalId: null as number | null,
    };
  }

  const isProfissional = access.roles.some((role) => (canonicalRoleName(role) ?? role) === "PROFISSIONAL");
  if (isProfissional) {
    const profissional = await obterProfissionalPorUsuario(userId);
    if (!profissional) {
      throw new AppError("Profissional sem vinculo", 403, "FORBIDDEN");
    }

    const vinculado = await profissionalAtendePaciente(pacienteId, profissional.id);
    if (!vinculado) {
      throw new AppError("Acesso negado ao paciente", 403, "FORBIDDEN");
    }

    return {
      userId,
      access,
      profissionalId: profissional.id,
    };
  }

  const isResponsavel = access.roles.some(
    (role) => (canonicalRoleName(role) ?? role) === "RESPONSAVEL"
  );
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
