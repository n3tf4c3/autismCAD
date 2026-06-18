import { requireApiPermission } from "@/server/auth/api-auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { resolveEffectiveRoleCanon } from "@/server/auth/effective-role";
import { isEvolucaoAccessAllowed } from "@/lib/prontuario/evolucao-access";
import {
  atualizarEvolucao,
  obterEvolucaoPorId,
} from "@/server/modules/prontuario/prontuario.service";
import { atualizarEvolucaoSchema } from "@autismcad/validators/prontuario/prontuario.schema";
import type { EvolucaoDetalheResponse, EvolucaoPayload } from "@autismcad/validators/api/v1";
import { AppError } from "@/server/shared/errors";
import { withErrorHandling } from "@/server/shared/http";
import type { UserAccess } from "@/server/auth/access";
import type { AuthenticatedUser } from "@/server/auth/auth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function parseEvolucaoId(raw: string): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError("Evolucao invalida", 400, "INVALID_INPUT");
  }
  return parsed;
}

// Mesma posse da web (canAccessEvolucao em prontuario.actions): acesso ao paciente +
// papel EFETIVO autorizado para a evolucao daquele profissional. Lanca 403 se negado.
async function assertCanAccessEvolucao(
  user: AuthenticatedUser,
  access: UserAccess,
  evolucao: { pacienteId: number; profissionalId: number | null }
): Promise<void> {
  const pacienteAccess = await assertPacienteAccess(user, evolucao.pacienteId, access);
  const allowed = isEvolucaoAccessAllowed({
    roleCanon: resolveEffectiveRoleCanon(user, access),
    accessProfissionalId: pacienteAccess.profissionalId,
    evolucaoProfissionalId: evolucao.profissionalId,
  });
  if (!allowed) throw new AppError("Acesso negado", 403, "FORBIDDEN");
}

function assertCamelCaseEvolucaoInput(input: unknown) {
  if (!input || typeof input !== "object") return;
  const payload = input as Record<string, unknown>;
  if ("atendimento_id" in payload || "profissional_id" in payload || "terapeuta_id" in payload) {
    throw new AppError(
      "Formato legado nao suportado. Use atendimentoId e profissionalId.",
      400,
      "INVALID_INPUT"
    );
  }
}

// Carrega a evolucao por id para edicao no mobile (pre-preenche o formulario).
export const GET = withErrorHandling(async (request: Request, context: RouteContext) => {
  const { id } = await context.params;
  const evolucaoId = parseEvolucaoId(id);
  const { user, access } = await requireApiPermission(request, [
    "evolucoes:view",
    "evolucoes:edit",
  ]);

  const evolucao = await obterEvolucaoPorId(evolucaoId);
  if (!evolucao) throw new AppError("Evolucao nao encontrada", 404, "NOT_FOUND");

  await assertCanAccessEvolucao(user, access, {
    pacienteId: Number(evolucao.pacienteId),
    profissionalId: evolucao.profissionalId == null ? null : Number(evolucao.profissionalId),
  });

  return Response.json({
    evolucao: {
      id: Number(evolucao.id),
      pacienteId: Number(evolucao.pacienteId),
      profissionalId: evolucao.profissionalId == null ? null : Number(evolucao.profissionalId),
      atendimentoId: evolucao.atendimentoId == null ? null : Number(evolucao.atendimentoId),
      data: String(evolucao.data ?? ""),
      payload: (evolucao.payload ?? null) as EvolucaoPayload | null,
    },
  } satisfies EvolucaoDetalheResponse);
});

// Atualiza a evolucao (correcao pelo mobile). Espelha atualizarEvolucaoAction.
export const PUT = withErrorHandling(async (request: Request, context: RouteContext) => {
  const { id } = await context.params;
  const evolucaoId = parseEvolucaoId(id);
  const { user, access } = await requireApiPermission(request, "evolucoes:edit");

  const evolucaoAtual = await obterEvolucaoPorId(evolucaoId);
  if (!evolucaoAtual) throw new AppError("Evolucao nao encontrada", 404, "NOT_FOUND");

  await assertCanAccessEvolucao(user, access, {
    pacienteId: Number(evolucaoAtual.pacienteId),
    profissionalId:
      evolucaoAtual.profissionalId == null ? null : Number(evolucaoAtual.profissionalId),
  });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    throw new AppError("Corpo invalido", 400, "INVALID_INPUT");
  }
  assertCamelCaseEvolucaoInput(body);
  const parsed = atualizarEvolucaoSchema.parse(body);

  const updated = await atualizarEvolucao(evolucaoId, parsed, user, evolucaoAtual, {
    roleCanon: resolveEffectiveRoleCanon(user, access),
  });
  return Response.json({ data: updated });
});
