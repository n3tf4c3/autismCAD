import { requirePermission } from "@/server/auth/auth";
import { evolutivoQuerySchema } from "@/server/modules/relatorios/relatorios.schema";
import { consolidateEvolutivoReport } from "@/server/modules/relatorios/relatorios.service";
import { buildEvolutivoPdf, type EvolutivoReport } from "@/server/modules/relatorios/evolutivo-pdf";
import { withErrorHandlingNoContext } from "@/server/shared/http";
import { Buffer } from "node:buffer";

function parseQuery(url: string) {
  const search = new URL(url).searchParams;
  return evolutivoQuerySchema.safeParse({
    pacienteId: search.get("pacienteId"),
    from: search.get("from") ?? undefined,
    to: search.get("to") ?? undefined,
    profissionalId: search.get("profissionalId") ?? undefined,
  });
}

export const GET = withErrorHandlingNoContext(async (request: Request) => {
  const { user } = await requirePermission("relatorios_clinicos:export");
  const parsed = parseQuery(request.url);
  if (!parsed.success) {
    return Response.json({ error: "Filtro invalido" }, { status: 400 });
  }
  const report = await consolidateEvolutivoReport({ query: parsed.data, user });
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
});
