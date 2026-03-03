import { parseJsonBody } from "@/lib/zod/api";
import { requirePermission } from "@/server/auth/auth";
import {
  atendimentosQuerySchema,
  saveAtendimentoSchema,
} from "@/server/modules/atendimentos/atendimentos.schema";
import {
  listarAtendimentos,
  salvarAtendimento,
} from "@/server/modules/atendimentos/atendimentos.service";
import { AppError } from "@/server/shared/errors";
import { withErrorHandlingNoContext } from "@/server/shared/http";

function parseQuery(url: string) {
  const search = new URL(url).searchParams;
  const parsed = atendimentosQuerySchema.safeParse({
    pacienteId: search.get("pacienteId") ?? undefined,
    terapeutaId: search.get("terapeutaId") ?? undefined,
    dataIni: search.get("dataIni") ?? undefined,
    dataFim: search.get("dataFim") ?? undefined,
  });
  if (!parsed.success) {
    throw new AppError("Filtro invalido", 400, "VALIDATION_ERROR");
  }
  return parsed.data;
}

export const GET = withErrorHandlingNoContext(async (request: Request) => {
  await requirePermission("consultas:view");
  const query = parseQuery(request.url);
  const rows = await listarAtendimentos(query);
  return Response.json(rows);
});

export const POST = withErrorHandlingNoContext(async (request: Request) => {
  await requirePermission("consultas:create");
  const payload = await parseJsonBody(request, saveAtendimentoSchema);
  const id = await salvarAtendimento(payload, null);
  return Response.json({ id }, { status: 201 });
});
