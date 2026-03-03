import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { listarEvolucoesPorPaciente } from "@/server/modules/prontuario/prontuario.service";
import { withErrorHandling } from "@/server/shared/http";

type RouteContext = {
  params: Promise<{ pacienteId: string }>;
};

export const GET = withErrorHandling(async (
  _request: Request,
  context: RouteContext
) => {
  const { user } = await requirePermission("evolucoes:view");
  const { pacienteId } = await context.params;
  const id = Number(pacienteId);
  if (!id) return Response.json({ error: "Paciente invalido" }, { status: 400 });

  await assertPacienteAccess(user, id);
  const rows = await listarEvolucoesPorPaciente(id);
  return Response.json(rows);
});
