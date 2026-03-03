import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { obterTimelineProntuario } from "@/server/modules/prontuario/prontuario.service";
import { withErrorHandling } from "@/server/shared/http";

type RouteContext = {
  params: Promise<{ pacienteId: string }>;
};

export const GET = withErrorHandling(async (
  _request: Request,
  context: RouteContext
) => {
  const { user } = await requirePermission("prontuario:view");
  const { pacienteId } = await context.params;
  const id = Number(pacienteId);
  if (!id) return Response.json({ error: "Paciente invalido" }, { status: 400 });

  await assertPacienteAccess(user, id);
  const timeline = await obterTimelineProntuario(id);
  return Response.json(timeline);
});
