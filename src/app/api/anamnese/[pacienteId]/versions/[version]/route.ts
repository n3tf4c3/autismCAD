import { requirePermission } from "@/server/auth/auth";
import { excluirAnamneseVersao } from "@/server/modules/anamnese/anamnese.service";
import { AppError } from "@/server/shared/errors";
import { withErrorHandling } from "@/server/shared/http";

type RouteContext = {
  params: Promise<{ pacienteId: string; version: string }>;
};

function parsePositiveInt(value: string, label: string, code: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    throw new AppError(`${label} invalido`, 400, code);
  }
  return parsed;
}

export const DELETE = withErrorHandling(async (_request: Request, context: RouteContext) => {
  await requirePermission("pacientes:delete");
  const { pacienteId: rawPacienteId, version: rawVersion } = await context.params;

  const pacienteId = parsePositiveInt(rawPacienteId, "Paciente", "INVALID_PACIENTE");
  const version = parsePositiveInt(rawVersion, "Versao", "INVALID_VERSION");

  const deleted = await excluirAnamneseVersao(pacienteId, version);
  return Response.json(deleted);
});
