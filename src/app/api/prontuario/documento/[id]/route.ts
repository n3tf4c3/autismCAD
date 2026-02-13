import { ZodError } from "zod";
import { parseJsonBody } from "@/lib/zod/api";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { toAppError } from "@/server/shared/errors";
import { jsonError } from "@/server/shared/http";
import {
  obterDocumento,
  excluirDocumento,
  salvarDocumento,
} from "@/server/modules/prontuario/prontuario.service";
import { salvarDocumentoSchema } from "@/server/modules/prontuario/prontuario.schema";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requirePermission("prontuario:view");
    const { id } = await context.params;
    const docId = Number(id);
    if (!docId) return Response.json({ error: "Documento invalido" }, { status: 400 });

    const doc = await obterDocumento(docId);
    if (!doc) return Response.json({ error: "Nao encontrado" }, { status: 404 });

    await assertPacienteAccess(user, Number(doc.paciente_id));
    return Response.json(doc);
  } catch (error) {
    return jsonError(toAppError(error));
  }
}

// Compatibilidade com o legado: POST /api/prontuario/documento/:pacienteId
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requirePermission("prontuario:create");
    const { id } = await context.params;
    const pacienteId = Number(id);
    if (!pacienteId) return Response.json({ error: "Paciente invalido" }, { status: 400 });

    await assertPacienteAccess(user, pacienteId);
    const payload = await parseJsonBody(request, salvarDocumentoSchema);
    const saved = await salvarDocumento(pacienteId, payload, user);
    return Response.json(saved, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Payload invalido" }, { status: 400 });
    }
    return jsonError(toAppError(error));
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requirePermission("prontuario:version");
    const { id } = await context.params;
    const docId = Number(id);
    if (!docId) return Response.json({ error: "Documento invalido" }, { status: 400 });

    const doc = await obterDocumento(docId);
    if (!doc) return Response.json({ error: "Documento nao encontrado" }, { status: 404 });
    if (doc.status === "Finalizado") {
      return Response.json(
        { error: "Documento finalizado nao pode ser removido" },
        { status: 409 }
      );
    }

    await assertPacienteAccess(user, Number(doc.paciente_id));
    const ok = await excluirDocumento(docId, Number(user.id));
    if (!ok) return Response.json({ error: "Documento nao encontrado" }, { status: 404 });
    return Response.json({ id: docId, deleted: true });
  } catch (error) {
    return jsonError(toAppError(error));
  }
}

