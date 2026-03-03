import { Buffer } from "node:buffer";
import { requirePermission } from "@/server/auth/auth";
import { clinicoQuerySchema } from "@/server/modules/relatorios/relatorios.schema";
import { consolidateClinicoReport } from "@/server/modules/relatorios/relatorios.service";
import { buildClinicoPdf, type ClinicoReport } from "@/server/modules/relatorios/clinico-pdf";
import { withErrorHandlingNoContext } from "@/server/shared/http";

function parseQuery(url: string) {
  const search = new URL(url).searchParams;
  return clinicoQuerySchema.safeParse({
    pacienteId: search.get("pacienteId"),
    version: search.get("version") ?? undefined,
    from: search.get("from") ?? undefined,
    to: search.get("to") ?? undefined,
    terapeutaId: search.get("terapeutaId") ?? undefined,
  });
}

export const GET = withErrorHandlingNoContext(async (request: Request) => {
  const { user } = await requirePermission("relatorios_clinicos:export");
  const parsed = parseQuery(request.url);
  if (!parsed.success) {
    return Response.json({ error: "Filtro invalido" }, { status: 400 });
  }
  const report = await consolidateClinicoReport({ query: parsed.data, user });
  const bytes = await buildClinicoPdf(report as unknown as ClinicoReport);
  const body = Buffer.from(bytes);

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": "inline; filename=\"relatorio-clinico.pdf\"",
      "cache-control": "no-store",
    },
  });
});
