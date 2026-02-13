import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { listarEvolucoesPorPaciente } from "@/server/modules/prontuario/prontuario.service";
import { toAppError } from "@/server/shared/errors";
import { jsonError } from "@/server/shared/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ pacienteId: string }> }
) {
  try {
    const { user } = await requirePermission("evolucoes:view");
    const { pacienteId } = await context.params;
    const id = Number(pacienteId);
    if (!id) return Response.json({ error: "Paciente invalido" }, { status: 400 });

    await assertPacienteAccess(user, id);
    const rows = await listarEvolucoesPorPaciente(id);
    return Response.json(rows);
  } catch (error) {
    return jsonError(toAppError(error));
  }
}

