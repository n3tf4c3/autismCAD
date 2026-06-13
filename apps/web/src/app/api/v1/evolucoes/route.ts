import { requireApiPermission } from "@/server/auth/api-auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { resolveEffectiveRoleCanon } from "@/server/auth/effective-role";
import { criarEvolucao } from "@/server/modules/prontuario/prontuario.service";
import { criarEvolucaoSchema } from "@autismcad/validators/prontuario/prontuario.schema";
import { AppError } from "@/server/shared/errors";
import { withErrorHandlingNoContext } from "@/server/shared/http";

export const runtime = "nodejs";

function parsePositiveInt(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    throw new AppError(`${label} invalido`, 400, "INVALID_INPUT");
  }
  return parsed;
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

// Espelha criarEvolucaoAction (prontuario.actions.ts) pelo caminho por token. pacienteId
// vem no corpo; o restante e o CriarEvolucaoInput (payload com metas/desempenho e
// comportamentos = paridade total com o formulario web). Autorizacao pelo papel EFETIVO
// (access fresco), nunca pela role defasada do token (achado 57).
export const POST = withErrorHandlingNoContext(async (request: Request) => {
  const { user, access } = await requireApiPermission(request, "evolucoes:create");

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    throw new AppError("Corpo invalido", 400, "INVALID_INPUT");
  }
  const { pacienteId, ...input } = body as Record<string, unknown>;
  const parsedPacienteId = parsePositiveInt(pacienteId, "Paciente");

  const acesso = await assertPacienteAccess(user, parsedPacienteId, access);
  assertCamelCaseEvolucaoInput(input);
  const parsedInput = criarEvolucaoSchema.parse(input ?? {});

  const saved = await criarEvolucao(parsedPacienteId, parsedInput, user, {
    roleCanon: resolveEffectiveRoleCanon(user, access),
    profissionalId: acesso.profissionalId,
  });

  return Response.json({ data: saved }, { status: 201 });
});
