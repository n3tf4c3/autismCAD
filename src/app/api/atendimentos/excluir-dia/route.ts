import { parseJsonBody } from "@/lib/zod/api";
import { requirePermission } from "@/server/auth/auth";
import { excluirDiaSchema } from "@/server/modules/atendimentos/atendimentos.schema";
import { excluirDia } from "@/server/modules/atendimentos/atendimentos.service";
import { toAppError } from "@/server/shared/errors";
import { jsonError } from "@/server/shared/http";

export async function POST(request: Request) {
  try {
    await requirePermission("consultas:cancel");
    const payload = await parseJsonBody(request, excluirDiaSchema);
    const result = await excluirDia(payload);
    return Response.json(result);
  } catch (error) {
    return jsonError(toAppError(error));
  }
}

