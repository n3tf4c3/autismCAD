import { ZodError } from "zod";
import { parseJsonBody } from "@/lib/zod/api";
import { requirePermission } from "@/server/auth/auth";
import {
  pacientesQuerySchema,
  savePacienteSchema,
} from "@/server/modules/pacientes/pacientes.schema";
import {
  findPacienteByCpfAtivo,
  listarPacientes,
  salvarPaciente,
} from "@/server/modules/pacientes/pacientes.service";
import { toAppError } from "@/server/shared/errors";
import { jsonError } from "@/server/shared/http";

function parseQuery(url: string) {
  const search = new URL(url).searchParams;
  return pacientesQuerySchema.parse({
    id: search.get("id") ?? undefined,
    nome: search.get("nome") ?? undefined,
    cpf: search.get("cpf") ?? undefined,
  });
}

export async function GET(request: Request) {
  try {
    await requirePermission("pacientes:view");
    const query = parseQuery(request.url);
    const rows = await listarPacientes(query);
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
    await requirePermission("pacientes:create");
    const payload = await parseJsonBody(request, savePacienteSchema);

    let id: number;
    let reaproveitado = false;
    const existing = await findPacienteByCpfAtivo(payload.cpf);
    if (existing) {
      id = await salvarPaciente(payload, existing.id);
      reaproveitado = true;
      return Response.json({ id, reaproveitado }, { status: 200 });
    }

    id = await salvarPaciente(payload, null);
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return jsonError(toAppError(error));
  }
}
