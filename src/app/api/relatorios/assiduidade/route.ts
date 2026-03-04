import { requirePermission } from "@/server/auth/auth";
import { assiduidadeQuerySchema } from "@/server/modules/relatorios/relatorios.schema";
import { consolidateAssiduidadeReport } from "@/server/modules/relatorios/relatorios.service";
import { AppError } from "@/server/shared/errors";
import { withErrorHandlingNoContext } from "@/server/shared/http";

function parseQuery(url: string) {
  const search = new URL(url).searchParams;
  const parsed = assiduidadeQuerySchema.safeParse({
    pacienteNome: search.get("pacienteNome") ?? undefined,
    terapeutaId: search.get("terapeutaId") ?? undefined,
    from: search.get("from") ?? undefined,
    to: search.get("to") ?? undefined,
    presenca: search.get("presenca") ?? undefined,
  });
  if (!parsed.success) {
    throw new AppError("Filtro invalido", 400, "VALIDATION_ERROR");
  }
  return parsed.data;
}

export const GET = withErrorHandlingNoContext(async (request: Request) => {
  const { user } = await requirePermission("relatorios_admin:view");
  const query = parseQuery(request.url);
  const data = await consolidateAssiduidadeReport({ query, user });
  return Response.json(data);
});
