import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { listarDocumentos } from "@/server/modules/prontuario/prontuario.service";
import { DOC_TYPES } from "@/server/modules/prontuario/prontuario.schema";
import { withErrorHandling } from "@/server/shared/http";

type RouteContext = {
  params: Promise<{ pacienteId: string }>;
};

export const GET = withErrorHandling(async (
  request: Request,
  context: RouteContext
) => {
  const { user } = await requirePermission("prontuario:view");
  const { pacienteId } = await context.params;
  const id = Number(pacienteId);
  if (!id) return Response.json({ error: "Paciente invalido" }, { status: 400 });

  const search = new URL(request.url).searchParams;
  const tipoRaw = (search.get("tipo") ?? "").toUpperCase().trim();
  const tipo = tipoRaw || null;
  if (tipo && !DOC_TYPES.includes(tipo as (typeof DOC_TYPES)[number])) {
    return Response.json({ error: "Tipo invalido" }, { status: 400 });
  }

  await assertPacienteAccess(user, id);
  const rows = await listarDocumentos(id, tipo);
  return Response.json(rows);
});
