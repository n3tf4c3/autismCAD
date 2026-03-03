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
  if (!evoId) return Response.json({ error: "Evolucao invalida" }, { status: 400 });

  const evolucao = await obterEvolucaoPorId(evoId);
  if (!evolucao) return Response.json({ error: "Evolucao nao encontrada" }, { status: 404 });

  const canAccess = await canAccessEvolucao(
    user,
    Number(evolucao.paciente_id),
    Number(evolucao.terapeuta_id)
  );
  if (!canAccess) {
    return Response.json({ error: "Acesso negado" }, { status: 403 });
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
  if (!pacienteId) return Response.json({ error: "Paciente invalido" }, { status: 400 });

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
  if (!evoId) return Response.json({ error: "Evolucao invalida" }, { status: 400 });

  const evolucaoAtual = await obterEvolucaoPorId(evoId);
  if (!evolucaoAtual) return Response.json({ error: "Evolucao nao encontrada" }, { status: 404 });

  const canAccess = await canAccessEvolucao(
    user,
    Number(evolucaoAtual.paciente_id),
    Number(evolucaoAtual.terapeuta_id)
  );
  if (!canAccess) {
    return Response.json({ error: "Acesso negado" }, { status: 403 });
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
  if (!evoId) return Response.json({ error: "Evolucao invalida" }, { status: 400 });

  const evolucaoAtual = await obterEvolucaoPorId(evoId);
  if (!evolucaoAtual) return Response.json({ error: "Evolucao nao encontrada" }, { status: 404 });

  const canAccess = await canAccessEvolucao(
    user,
    Number(evolucaoAtual.paciente_id),
    Number(evolucaoAtual.terapeuta_id)
  );
  if (!canAccess) {
    return Response.json({ error: "Acesso negado" }, { status: 403 });
  }

  const ok = await excluirEvolucao(evoId, Number(user.id));
  if (!ok) return Response.json({ error: "Evolucao nao encontrada" }, { status: 404 });
  return Response.json({ id: evoId, deleted: true });
});
