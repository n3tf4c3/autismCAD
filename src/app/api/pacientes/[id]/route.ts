import { idParamSchema, parseJsonBody } from "@/lib/zod/api";
import { requirePermission } from "@/server/auth/auth";
import { savePacienteSchema } from "@/server/modules/pacientes/pacientes.schema";
import {
  setPacienteAtivo,
  salvarPaciente,
  softDeletePaciente,
} from "@/server/modules/pacientes/pacientes.service";
import { withErrorHandling } from "@/server/shared/http";
import { parseAtivo, patchAtivoSchema } from "@/server/shared/parse-ativo";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const PUT = withErrorHandling(async (request: Request, context: RouteContext) => {
  await requirePermission("pacientes:edit");
  const { id } = idParamSchema.parse(await context.params);
  const payload = await parseJsonBody(request, savePacienteSchema);
  const savedId = await salvarPaciente(payload, id);
  return Response.json({ id: savedId });
});

export const DELETE = withErrorHandling(async (_request: Request, context: RouteContext) => {
  const { user } = await requirePermission("pacientes:delete");
  const { id } = idParamSchema.parse(await context.params);
  const result = await softDeletePaciente(id, Number(user.id));
  return Response.json({ id: result.id });
});

export const PATCH = withErrorHandling(async (request: Request, context: RouteContext) => {
  await requirePermission("pacientes:edit");
  const { id } = idParamSchema.parse(await context.params);
  const payload = await parseJsonBody(request, patchAtivoSchema);
  const ativo = parseAtivo(payload.ativo);
  const result = await setPacienteAtivo(id, ativo);
  return Response.json(result);
});
