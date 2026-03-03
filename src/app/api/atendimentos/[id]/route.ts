import { idParamSchema, parseJsonBody } from "@/lib/zod/api";
import { requirePermission } from "@/server/auth/auth";
import { saveAtendimentoSchema } from "@/server/modules/atendimentos/atendimentos.schema";
import {
  salvarAtendimento,
  softDeleteAtendimento,
} from "@/server/modules/atendimentos/atendimentos.service";
import { withErrorHandling } from "@/server/shared/http";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const PUT = withErrorHandling(async (request: Request, context: RouteContext) => {
  await requirePermission(["consultas:edit", "consultas:presence"]);
  const { id } = idParamSchema.parse(await context.params);
  const payload = await parseJsonBody(request, saveAtendimentoSchema);
  const savedId = await salvarAtendimento(payload, id);
  return Response.json({ id: savedId });
});

export const DELETE = withErrorHandling(async (_request: Request, context: RouteContext) => {
  const { user } = await requirePermission("consultas:cancel");
  const { id } = idParamSchema.parse(await context.params);
  const result = await softDeleteAtendimento(id, Number(user.id));
  return Response.json({ id: result.id });
});
