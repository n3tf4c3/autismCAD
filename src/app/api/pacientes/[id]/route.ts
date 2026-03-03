import { idParamSchema, parseJsonBody } from "@/lib/zod/api";
import { requirePermission } from "@/server/auth/auth";
import { savePacienteSchema } from "@/server/modules/pacientes/pacientes.schema";
import {
  setPacienteAtivo,
  salvarPaciente,
  softDeletePaciente,
} from "@/server/modules/pacientes/pacientes.service";
import { AppError } from "@/server/shared/errors";
import { withErrorHandling } from "@/server/shared/http";
import { z } from "zod";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const patchPacienteSchema = z.object({
  ativo: z.union([z.boolean(), z.number(), z.string()]),
});

function parseAtivo(value: boolean | number | string): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const parsed = value.trim().toLowerCase();
  if (["1", "true", "ativo"].includes(parsed)) return true;
  if (["0", "false", "inativo", "arquivado"].includes(parsed)) return false;
  throw new AppError("Campo ativo invalido", 400, "INVALID_INPUT");
}

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
  const payload = await parseJsonBody(request, patchPacienteSchema);
  const ativo = parseAtivo(payload.ativo);
  const result = await setPacienteAtivo(id, ativo);
  return Response.json(result);
});
