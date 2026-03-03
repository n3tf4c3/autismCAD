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
import { AppError } from "@/server/shared/errors";
import { withErrorHandlingNoContext } from "@/server/shared/http";

function parseQuery(url: string) {
  const search = new URL(url).searchParams;
  const parsed = pacientesQuerySchema.safeParse({
    id: search.get("id") ?? undefined,
    nome: search.get("nome") ?? undefined,
    cpf: search.get("cpf") ?? undefined,
  });
  if (!parsed.success) {
    throw new AppError("Filtro invalido", 400, "VALIDATION_ERROR");
  }
  return parsed.data;
}

export const GET = withErrorHandlingNoContext(async (request: Request) => {
  await requirePermission("pacientes:view");
  const query = parseQuery(request.url);
  const rows = await listarPacientes(query);
  return Response.json(rows);
});

export const POST = withErrorHandlingNoContext(async (request: Request) => {
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
});
