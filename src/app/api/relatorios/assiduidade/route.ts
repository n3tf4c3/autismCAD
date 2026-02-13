import { ZodError } from "zod";
import { requirePermission } from "@/server/auth/auth";
import { assiduidadeQuerySchema } from "@/server/modules/relatorios/relatorios.schema";
import { consolidateAssiduidadeReport } from "@/server/modules/relatorios/relatorios.service";
import { toAppError } from "@/server/shared/errors";
import { jsonError } from "@/server/shared/http";

function parseQuery(url: string) {
  const search = new URL(url).searchParams;
  return assiduidadeQuerySchema.parse({
    pacienteNome: search.get("pacienteNome") ?? undefined,
    terapeutaId: search.get("terapeutaId") ?? undefined,
    from: search.get("from") ?? undefined,
    to: search.get("to") ?? undefined,
    presenca: search.get("presenca") ?? undefined,
  });
}

export async function GET(request: Request) {
  try {
    const { user } = await requirePermission("relatorios_clinicos:view");
    const query = parseQuery(request.url);
    const data = await consolidateAssiduidadeReport({ query, user });
    return Response.json(data);
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Filtro invalido" }, { status: 400 });
    }
    return jsonError(toAppError(error));
  }
}

