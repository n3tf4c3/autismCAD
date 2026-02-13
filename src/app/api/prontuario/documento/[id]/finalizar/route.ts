import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { finalizarDocumento, obterDocumento } from "@/server/modules/prontuario/prontuario.service";
import { toAppError } from "@/server/shared/errors";
import { jsonError } from "@/server/shared/http";

export async function PUT(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
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
  } catch (error) {
    return jsonError(toAppError(error));
  }
}

