import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { finalizarDocumento, obterDocumento } from "@/server/modules/prontuario/prontuario.service";
import { withErrorHandling } from "@/server/shared/http";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const PUT = withErrorHandling(async (
  _request: Request,
  context: RouteContext
) => {
  const { user } = await requirePermission("prontuario:finalize");
  const { id } = await context.params;
  const docId = Number(id);
  if (!docId) return Response.json({ error: "Documento invalido" }, { status: 400 });

  const doc = await obterDocumento(docId);
  if (!doc) return Response.json({ error: "Documento nao encontrado" }, { status: 404 });
  if (doc.status === "Finalizado") {
    return Response.json({ error: "Documento ja finalizado" }, { status: 409 });
  }

  await assertPacienteAccess(user, Number(doc.paciente_id));
  const updated = await finalizarDocumento(docId);
  if (!updated) return Response.json({ error: "Documento nao encontrado" }, { status: 404 });
  return Response.json(updated);
});
