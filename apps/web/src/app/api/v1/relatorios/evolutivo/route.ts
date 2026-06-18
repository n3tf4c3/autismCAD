import { requireApiPermission } from "@/server/auth/api-auth";
import { evolutivoQuerySchema } from "@autismcad/validators/relatorios/relatorios.schema";
import type { EvolutivoReportResponse } from "@autismcad/validators/api/v1";
import { consolidateEvolutivoReport } from "@/server/modules/relatorios/relatorios.service";
import { withErrorHandlingNoContext } from "@/server/shared/http";

export const runtime = "nodejs";

// Devolutiva consolidada (JSON) para renderizacao nativa no app. Mesmo service da web
// (gerarRelatorioEvolutivoAction); assertPacienteAccess dentro do service garante que o
// responsavel so ve paciente vinculado.
export const GET = withErrorHandlingNoContext(async (request: Request) => {
  const { user, access } = await requireApiPermission(request, "relatorios_clinicos:view");
  const search = new URL(request.url).searchParams;

  const parsed = evolutivoQuerySchema.parse({
    pacienteId: search.get("pacienteId") ?? undefined,
    from: search.get("from") ?? undefined,
    to: search.get("to") ?? undefined,
    profissionalId: search.get("profissionalId") ?? undefined,
  });

  const report = await consolidateEvolutivoReport({ query: parsed, user, access });
  return Response.json({ report } satisfies EvolutivoReportResponse);
});
