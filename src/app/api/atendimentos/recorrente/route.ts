import { parseJsonBody } from "@/lib/zod/api";
import { requirePermission } from "@/server/auth/auth";
import { recorrenteSchema } from "@/server/modules/atendimentos/atendimentos.schema";
import { criarRecorrentes } from "@/server/modules/atendimentos/atendimentos.service";
import { toAppError } from "@/server/shared/errors";
import { jsonError } from "@/server/shared/http";

export async function POST(request: Request) {
  try {
    await requirePermission("consultas:create");
    const payload = await parseJsonBody(request, recorrenteSchema);
    const result = await criarRecorrentes(payload);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return jsonError(toAppError(error));
  }
}

