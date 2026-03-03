import { parseJsonBody } from "@/lib/zod/api";
import { requirePermission } from "@/server/auth/auth";
import { recorrenteSchema } from "@/server/modules/atendimentos/atendimentos.schema";
import { criarRecorrentes } from "@/server/modules/atendimentos/atendimentos.service";
import { withErrorHandlingNoContext } from "@/server/shared/http";

export const POST = withErrorHandlingNoContext(async (request: Request) => {
  await requirePermission("consultas:create");
  const payload = await parseJsonBody(request, recorrenteSchema);
  const result = await criarRecorrentes(payload);
  return Response.json(result, { status: 201 });
});
