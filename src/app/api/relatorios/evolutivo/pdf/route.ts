import { ZodError } from "zod";
import { requirePermission } from "@/server/auth/auth";
import { evolutivoQuerySchema } from "@/server/modules/relatorios/relatorios.schema";
import { consolidateEvolutivoReport } from "@/server/modules/relatorios/relatorios.service";
import { buildEvolutivoPdf, type EvolutivoReport } from "@/server/modules/relatorios/evolutivo-pdf";
import { toAppError } from "@/server/shared/errors";
import { Buffer } from "node:buffer";

function parseQuery(url: string) {
  const search = new URL(url).searchParams;
  return evolutivoQuerySchema.parse({
    pacienteId: search.get("pacienteId"),
    from: search.get("from") ?? undefined,
    to: search.get("to") ?? undefined,
    terapeutaId: search.get("terapeutaId") ?? undefined,
  });
}

export async function GET(request: Request) {
  try {
    const { user } = await requirePermission("relatorios_clinicos:export");
    const query = parseQuery(request.url);
    const report = await consolidateEvolutivoReport({ query, user });
    const bytes = await buildEvolutivoPdf(report as unknown as EvolutivoReport);
    const body = Buffer.from(bytes);

    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": "inline; filename=\"relatorio-evolutivo.pdf\"",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Filtro invalido" }, { status: 400 });
    }
    const err = toAppError(error);
    return Response.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
