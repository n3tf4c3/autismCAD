import { requireApiPermission } from "@/server/auth/api-auth";
import { pacientesQuerySchema } from "@autismcad/validators/pacientes/pacientes.schema";
import type { PacientesListResponse } from "@autismcad/validators/api/v1";
import { listarPacientesPorUsuario } from "@/server/modules/pacientes/pacientes.service";
import { withErrorHandlingNoContext } from "@/server/shared/http";

export const runtime = "nodejs";

// Pacientes escopados ao usuario (profissional: os que atende; responsavel: vinculados).
// O service ja restringe por papel; a permissao cobre os dois fluxos do MVP mobile
// (profissional tem pacientes:view; responsavel tem relatorios_clinicos:view).
export const GET = withErrorHandlingNoContext(async (request: Request) => {
  const { user } = await requireApiPermission(request, [
    "pacientes:view",
    "relatorios_clinicos:view",
  ]);
  const search = new URL(request.url).searchParams;

  const parsed = pacientesQuerySchema.parse({
    id: search.get("id") ?? undefined,
    nome: search.get("nome") ?? undefined,
    cpf: search.get("cpf") ?? undefined,
  });

  const items = await listarPacientesPorUsuario(Number(user.id), parsed);
  return Response.json({ items } satisfies PacientesListResponse);
});
