import { requirePermission } from "@/server/auth/auth";
import { evolutivoQuerySchema } from "@/server/modules/relatorios/relatorios.schema";
import { consolidateEvolutivoReport } from "@/server/modules/relatorios/relatorios.service";
import { AppError } from "@/server/shared/errors";
import { withErrorHandlingNoContext } from "@/server/shared/http";

function parseQuery(url: string) {
  const search = new URL(url).searchParams;
  const parsed = evolutivoQuerySchema.safeParse({
    pacienteId: search.get("pacienteId"),
    from: search.get("from") ?? undefined,
    to: search.get("to") ?? undefined,
    terapeutaId: search.get("terapeutaId") ?? undefined,
  });
  if (!parsed.success) {
    throw new AppError("Filtro invalido", 400, "VALIDATION_ERROR");
  }
  return parsed.data;
}

export const GET = withErrorHandlingNoContext(async (request: Request) => {
  const { user } = await requirePermission("relatorios_clinicos:view");
  const query = parseQuery(request.url);
  const data = await consolidateEvolutivoReport({ query, user });
  return Response.json(data);
});
