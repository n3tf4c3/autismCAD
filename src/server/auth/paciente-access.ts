import "server-only";

import { canonicalRoleName, ADMIN_ROLES } from "@/server/auth/permissions";
import { loadUserAccess } from "@/server/auth/access";
import { AppError } from "@/server/shared/errors";
import {
  obterTerapeutaPorUsuario,
  terapeutaAtendePaciente,
} from "@/server/modules/terapeutas/terapeutas.service";

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
  if (isAdmin) return { userId, access, terapeutaId: null as number | null };

  const isTerapeuta = access.roles.some((role) => (canonicalRoleName(role) ?? role) === "TERAPEUTA");
  if (!isTerapeuta) {
    throw new AppError("Acesso negado", 403, "FORBIDDEN");
  }

  const terapeuta = await obterTerapeutaPorUsuario(userId);
  if (!terapeuta) {
    throw new AppError("Terapeuta sem vinculo", 403, "FORBIDDEN");
  }

  const vinculado = await terapeutaAtendePaciente(pacienteId, terapeuta.id);
  if (!vinculado) {
    throw new AppError("Acesso negado ao paciente", 403, "FORBIDDEN");
  }

  return { userId, access, terapeutaId: terapeuta.id };
}

