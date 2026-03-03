import { parseJsonBody } from "@/lib/zod/api";
import { requirePermission } from "@/server/auth/auth";
import { excluirDiaSchema } from "@/server/modules/atendimentos/atendimentos.schema";
import { excluirDia } from "@/server/modules/atendimentos/atendimentos.service";
import { withErrorHandlingNoContext } from "@/server/shared/http";

export const POST = withErrorHandlingNoContext(async (request: Request) => {
  const { user } = await requirePermission("consultas:cancel");
  const payload = await parseJsonBody(request, excluirDiaSchema);
  const result = await excluirDia(payload, Number(user.id));
  return Response.json(result);
});
