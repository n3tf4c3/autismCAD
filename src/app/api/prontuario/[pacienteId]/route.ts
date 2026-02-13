import { ZodError } from "zod";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { obterTimelineProntuario } from "@/server/modules/prontuario/prontuario.service";
import { toAppError } from "@/server/shared/errors";
import { jsonError } from "@/server/shared/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ pacienteId: string }> }
) {
  try {
    const { user } = await requirePermission("prontuario:view");
    const { pacienteId } = await context.params;
    const id = Number(pacienteId);
    if (!id) return Response.json({ error: "Paciente invalido" }, { status: 400 });

    await assertPacienteAccess(user, id);
    const timeline = await obterTimelineProntuario(id);
    return Response.json(timeline);
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Filtro invalido" }, { status: 400 });
    }
    return jsonError(toAppError(error));
  }
}

