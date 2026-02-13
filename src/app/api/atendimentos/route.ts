import { ZodError } from "zod";
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
import { toAppError } from "@/server/shared/errors";
import { jsonError } from "@/server/shared/http";

function parseQuery(url: string) {
  const search = new URL(url).searchParams;
  return atendimentosQuerySchema.parse({
    pacienteId: search.get("pacienteId") ?? undefined,
    terapeutaId: search.get("terapeutaId") ?? undefined,
    dataIni: search.get("dataIni") ?? undefined,
    dataFim: search.get("dataFim") ?? undefined,
  });
}

export async function GET(request: Request) {
  try {
    await requirePermission("consultas:view");
    const query = parseQuery(request.url);
    const rows = await listarAtendimentos(query);
    return Response.json(rows);
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Filtro invalido" }, { status: 400 });
    }
    return jsonError(toAppError(error));
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission("consultas:create");
    const payload = await parseJsonBody(request, saveAtendimentoSchema);
    const id = await salvarAtendimento(payload, null);
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return jsonError(toAppError(error));
  }
}

