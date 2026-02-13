import { idParamSchema, parseJsonBody } from "@/lib/zod/api";
import { requirePermission } from "@/server/auth/auth";
import { savePacienteSchema } from "@/server/modules/pacientes/pacientes.schema";
import {
  salvarPaciente,
  softDeletePaciente,
} from "@/server/modules/pacientes/pacientes.service";
import { AppError, toAppError } from "@/server/shared/errors";
import { jsonError } from "@/server/shared/http";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  try {
    await requirePermission("pacientes:edit");
    const { id } = idParamSchema.parse(await context.params);
    const payload = await parseJsonBody(request, savePacienteSchema);
    const savedId = await salvarPaciente(payload, id);
    return Response.json({ id: savedId });
  } catch (error) {
    return jsonError(toAppError(error));
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { user } = await requirePermission("pacientes:delete");
    const { id } = idParamSchema.parse(await context.params);
    if (!id) {
      throw new AppError("ID invalido", 400, "INVALID_ID");
    }
    const result = await softDeletePaciente(id, Number(user.id));
    return Response.json({ id: result.id });
  } catch (error) {
    return jsonError(toAppError(error));
  }
}
