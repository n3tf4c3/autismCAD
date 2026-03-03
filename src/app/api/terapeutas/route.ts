import { parseJsonBody } from "@/lib/zod/api";
import { requirePermission } from "@/server/auth/auth";
import {
  saveTerapeutaSchema,
  terapeutasQuerySchema,
} from "@/server/modules/terapeutas/terapeutas.schema";
import {
  listarTerapeutas,
  salvarTerapeuta,
} from "@/server/modules/terapeutas/terapeutas.service";
import { AppError } from "@/server/shared/errors";
import { withErrorHandlingNoContext } from "@/server/shared/http";

function parseQuery(url: string) {
  const search = new URL(url).searchParams;
  const parsed = terapeutasQuerySchema.safeParse({
    id: search.get("id") ?? undefined,
    nome: search.get("nome") ?? undefined,
    cpf: search.get("cpf") ?? undefined,
    especialidade: search.get("especialidade") ?? undefined,
  });
  if (!parsed.success) {
    throw new AppError("Filtro invalido", 400, "VALIDATION_ERROR");
  }
  return parsed.data;
}

export const GET = withErrorHandlingNoContext(async (request: Request) => {
  await requirePermission("terapeutas:view");
  const query = parseQuery(request.url);
  const rows = await listarTerapeutas(query);
  return Response.json(rows);
});

export const POST = withErrorHandlingNoContext(async (request: Request) => {
  await requirePermission("terapeutas:create");
  const payload = await parseJsonBody(request, saveTerapeutaSchema);
  const id = await salvarTerapeuta(payload, null);
  return Response.json({ id }, { status: 201 });
});
