import { ZodError } from "zod";
import { parseJsonBody } from "@/lib/zod/api";
import { requirePermission } from "@/server/auth/auth";
import {
  saveTerapeutaSchema,
  terapeutasQuerySchema,
} from "@/server/modules/terapeutas/terapeutas.schema";
import {
  listarTerapeutas,
  salvarTerapeuta,
} from "@/server/modules/terapeutas/terapeutas.service";
import { toAppError } from "@/server/shared/errors";
import { jsonError } from "@/server/shared/http";

function parseQuery(url: string) {
  const search = new URL(url).searchParams;
  return terapeutasQuerySchema.parse({
    id: search.get("id") ?? undefined,
    nome: search.get("nome") ?? undefined,
    cpf: search.get("cpf") ?? undefined,
    especialidade: search.get("especialidade") ?? undefined,
  });
}

export async function GET(request: Request) {
  try {
    await requirePermission("terapeutas:view");
    const query = parseQuery(request.url);
    const rows = await listarTerapeutas(query);
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
    await requirePermission("terapeutas:create");
    const payload = await parseJsonBody(request, saveTerapeutaSchema);
    const id = await salvarTerapeuta(payload, null);
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return jsonError(toAppError(error));
  }
}
