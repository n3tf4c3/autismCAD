import { parseJsonBody } from "@/lib/zod/api";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { canonicalRoleName } from "@/server/auth/permissions";
import {
  atualizarEvolucao,
  criarEvolucao,
  excluirEvolucao,
  obterEvolucaoPorId,
} from "@/server/modules/prontuario/prontuario.service";
import {
  atualizarEvolucaoSchema,
  criarEvolucaoSchema,
} from "@/server/modules/prontuario/prontuario.schema";
import { AppError } from "@/server/shared/errors";
import { withErrorHandling } from "@/server/shared/http";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function canAccessEvolucao(
  user: { role: string; id: string | number },
  pacienteId: number,
  terapeutaId: number | null
): Promise<boolean> {
  const access = await assertPacienteAccess(user, pacienteId);
  if ((canonicalRoleName(user.role) ?? user.role) !== "TERAPEUTA") {
    return true;
  }
  return !!access.terapeutaId && access.terapeutaId === terapeutaId;
}

export const GET = withErrorHandling(async (
  _request: Request,
  context: RouteContext
) => {
  const { user } = await requirePermission("evolucoes:view");
  const { id } = await context.params;
  const evoId = Number(id);
  if (!evoId) throw new AppError("Evolucao invalida", 400, "INVALID_INPUT");

  const evolucao = await obterEvolucaoPorId(evoId);
  if (!evolucao) throw new AppError("Evolucao nao encontrada", 404, "NOT_FOUND");

  const canAccess = await canAccessEvolucao(
    user,
    Number(evolucao.paciente_id),
    Number(evolucao.terapeuta_id)
  );
  if (!canAccess) {
    throw new AppError("Acesso negado", 403, "FORBIDDEN");
  }

  return Response.json({ ...evolucao, payload: evolucao.payload ?? {} });
});

// Compatibilidade com o legado: POST /api/prontuario/evolucao/:pacienteId
export const POST = withErrorHandling(async (
  request: Request,
  context: RouteContext
) => {
  const { user } = await requirePermission("evolucoes:create");
  const { id } = await context.params;
  const pacienteId = Number(id);
  if (!pacienteId) throw new AppError("Paciente invalido", 400, "INVALID_INPUT");

  await assertPacienteAccess(user, pacienteId);
  const payload = await parseJsonBody(request, criarEvolucaoSchema);
  const saved = await criarEvolucao(pacienteId, payload, user);
  return Response.json(saved, { status: 201 });
});

export const PUT = withErrorHandling(async (
  request: Request,
  context: RouteContext
) => {
  const { user } = await requirePermission("evolucoes:edit");
  const { id } = await context.params;
  const evoId = Number(id);
  if (!evoId) throw new AppError("Evolucao invalida", 400, "INVALID_INPUT");

  const evolucaoAtual = await obterEvolucaoPorId(evoId);
  if (!evolucaoAtual) throw new AppError("Evolucao nao encontrada", 404, "NOT_FOUND");

  const canAccess = await canAccessEvolucao(
    user,
    Number(evolucaoAtual.paciente_id),
    Number(evolucaoAtual.terapeuta_id)
  );
  if (!canAccess) {
    throw new AppError("Acesso negado", 403, "FORBIDDEN");
  }

  const payload = await parseJsonBody(request, atualizarEvolucaoSchema);
  const updated = await atualizarEvolucao(evoId, payload, user, evolucaoAtual);
  return Response.json(updated);
});

export const DELETE = withErrorHandling(async (
  _request: Request,
  context: RouteContext
) => {
  const { user } = await requirePermission("evolucoes:delete");
  const { id } = await context.params;
  const evoId = Number(id);
  if (!evoId) throw new AppError("Evolucao invalida", 400, "INVALID_INPUT");

  const evolucaoAtual = await obterEvolucaoPorId(evoId);
  if (!evolucaoAtual) throw new AppError("Evolucao nao encontrada", 404, "NOT_FOUND");

  const canAccess = await canAccessEvolucao(
    user,
    Number(evolucaoAtual.paciente_id),
    Number(evolucaoAtual.terapeuta_id)
  );
  if (!canAccess) {
    throw new AppError("Acesso negado", 403, "FORBIDDEN");
  }

  const ok = await excluirEvolucao(evoId, Number(user.id));
  if (!ok) throw new AppError("Evolucao nao encontrada", 404, "NOT_FOUND");
  return Response.json({ id: evoId, deleted: true });
});
