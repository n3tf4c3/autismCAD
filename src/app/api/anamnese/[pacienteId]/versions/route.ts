import { requirePermission } from "@/server/auth/auth";
import { listVersionsQuerySchema } from "@/server/modules/anamnese/anamnese.schema";
import { assertPacienteExists, listarAnamneseVersoes } from "@/server/modules/anamnese/anamnese.service";
import { AppError, toAppError } from "@/server/shared/errors";
import { jsonError } from "@/server/shared/http";

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

export async function GET(request: Request, context: RouteContext) {
  try {
    await requirePermission("pacientes:view");
    const { pacienteId: raw } = await context.params;
    const pacienteId = parsePacienteId(raw);

    await assertPacienteExists(pacienteId);

    const search = new URL(request.url).searchParams;
    const limit = search.get("limit") ?? undefined;
    const parsed = listVersionsQuerySchema.parse({ limit });

    const rows = await listarAnamneseVersoes(pacienteId, parsed.limit ?? 50);
    return Response.json(rows);
  } catch (error) {
    return jsonError(toAppError(error));
  }
}

