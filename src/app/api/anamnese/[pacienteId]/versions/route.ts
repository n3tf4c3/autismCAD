import { requirePermission } from "@/server/auth/auth";
import { listVersionsQuerySchema } from "@/server/modules/anamnese/anamnese.schema";
import { assertPacienteExists, listarAnamneseVersoes } from "@/server/modules/anamnese/anamnese.service";
import { AppError } from "@/server/shared/errors";
import { withErrorHandling } from "@/server/shared/http";

type RouteContext = {
  params: Promise<{ pacienteId: string }>;
};

function parsePacienteId(value: string) {
  const id = Number(value);
  if (!Number.isFinite(id) || id <= 0) {
    throw new AppError("Paciente invalido", 400, "INVALID_PACIENTE");
  }
  return id;
}

export const GET = withErrorHandling(async (request: Request, context: RouteContext) => {
  await requirePermission("pacientes:view");
  const { pacienteId: raw } = await context.params;
  const pacienteId = parsePacienteId(raw);

  await assertPacienteExists(pacienteId);

  const search = new URL(request.url).searchParams;
  const limit = search.get("limit") ?? undefined;
  const parsed = listVersionsQuerySchema.parse({ limit });

  const rows = await listarAnamneseVersoes(pacienteId, parsed.limit ?? 50);
  return Response.json(rows);
});
