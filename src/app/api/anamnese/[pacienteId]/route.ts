import { requirePermission } from "@/server/auth/auth";
import { salvarAnamneseCompleta, obterAnamneseBase, obterAnamneseVersao } from "@/server/modules/anamnese/anamnese.service";
import { AppError } from "@/server/shared/errors";
import { withErrorHandling } from "@/server/shared/http";

type RouteContext = {
  params: Promise<{ pacienteId: string }>;
};

function parsePacienteId(value: string) {
  const id = Number(value);
  if (!Number.isFinite(id) || id <= 0) {
    throw new AppError("Paciente invalido", 400, "INVALID_PACIENTE");
  }
  return id;
}

export const GET = withErrorHandling(async (request: Request, context: RouteContext) => {
  await requirePermission("pacientes:view");
  const { pacienteId: raw } = await context.params;
  const pacienteId = parsePacienteId(raw);

  const search = new URL(request.url).searchParams;
  const versionRaw = search.get("version");
  const version = versionRaw !== null ? Number(versionRaw) : null;
  if (versionRaw !== null && !Number.isFinite(version)) {
    throw new AppError("Versao invalida", 400, "INVALID_VERSION");
  }

  const versao = await obterAnamneseVersao(pacienteId, versionRaw !== null ? version : null);
  if (versao) return Response.json(versao);

  const base = await obterAnamneseBase(pacienteId);
  if (!base) {
    return Response.json({ error: "Anamnese nao encontrada" }, { status: 404 });
  }
  return Response.json(base);
});

export const PUT = withErrorHandling(async (request: Request, context: RouteContext) => {
  await requirePermission("pacientes:edit");
  const { pacienteId: raw } = await context.params;
  const pacienteId = parsePacienteId(raw);
  const body = await request.json();

  const status = (body?.status as string | undefined) ?? "Rascunho";
  const saved = await salvarAnamneseCompleta({
    pacienteId,
    body: body ?? {},
    status,
  });

  return Response.json(saved);
});
