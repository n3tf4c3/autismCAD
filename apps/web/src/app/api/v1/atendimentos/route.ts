import { requireApiPermission } from "@/server/auth/api-auth";
import { atendimentosQuerySchema } from "@autismcad/validators/atendimentos/atendimentos.schema";
import { listarAtendimentosPorUsuario } from "@/server/modules/atendimentos/atendimentos.service";
import { withErrorHandlingNoContext } from "@/server/shared/http";

export const runtime = "nodejs";

// Agenda escopada ao usuario logado (mesmo scoping por papel de listarAtendimentosAction).
// Aceita `data` como atalho para a agenda do dia (dataIni=dataFim=data).
export const GET = withErrorHandlingNoContext(async (request: Request) => {
  const { user } = await requireApiPermission(request, "consultas:view");
  const search = new URL(request.url).searchParams;
  const data = search.get("data") ?? undefined;

  const parsed = atendimentosQuerySchema.parse({
    pacienteId: search.get("pacienteId") ?? undefined,
    profissionalId: search.get("profissionalId") ?? undefined,
    dataIni: search.get("dataIni") ?? data ?? undefined,
    dataFim: search.get("dataFim") ?? data ?? undefined,
  });

  const items = await listarAtendimentosPorUsuario(Number(user.id), parsed);
  return Response.json({ items });
});
