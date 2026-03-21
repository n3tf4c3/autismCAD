import { requirePermission } from "@/server/auth/auth";
import { planoEnsinoQuerySchema } from "@/server/modules/relatorios/relatorios.schema";
import { consolidatePlanoEnsinoReport } from "@/server/modules/relatorios/relatorios.service";
import {
  buildPlanoEnsinoDocx,
  type PlanoEnsinoReport,
} from "@/server/modules/relatorios/plano-ensino-docx";
import { withErrorHandlingNoContext } from "@/server/shared/http";

export const runtime = "nodejs";

function parseQuery(url: string) {
  const search = new URL(url).searchParams;
  return planoEnsinoQuerySchema.safeParse({
    pacienteId: search.get("pacienteId"),
    from: search.get("from") ?? undefined,
    to: search.get("to") ?? undefined,
  });
}

export const GET = withErrorHandlingNoContext(async (request: Request) => {
  const { user } = await requirePermission("relatorios_clinicos:export");
  const parsed = parseQuery(request.url);
  if (!parsed.success) {
    return Response.json({ error: "Filtro invalido" }, { status: 400 });
  }

  const report = await consolidatePlanoEnsinoReport({ query: parsed.data, user });
  const body = await buildPlanoEnsinoDocx(report as unknown as PlanoEnsinoReport);

  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": "attachment; filename=\"relatorio-plano-ensino.docx\"",
      "cache-control": "no-store",
    },
  });
});
