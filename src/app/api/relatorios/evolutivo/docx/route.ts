import { requirePermission } from "@/server/auth/auth";
import { evolutivoQuerySchema } from "@/server/modules/relatorios/relatorios.schema";
import { consolidateEvolutivoReport } from "@/server/modules/relatorios/relatorios.service";
import { buildEvolutivoDocx, type EvolutivoDocxReport } from "@/server/modules/relatorios/evolutivo-docx";
import { withErrorHandlingNoContext } from "@/server/shared/http";

export const runtime = "nodejs";

function parseQuery(url: string) {
  const search = new URL(url).searchParams;
  return evolutivoQuerySchema.safeParse({
    pacienteId: search.get("pacienteId"),
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

  const report = await consolidateEvolutivoReport({ query: parsed.data, user });
  const body = await buildEvolutivoDocx(report as unknown as EvolutivoDocxReport);

  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": "attachment; filename=\"relatorio-devolutivo.docx\"",
      "cache-control": "no-store",
    },
  });
});
