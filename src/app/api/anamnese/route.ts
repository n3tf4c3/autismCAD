import { requirePermission } from "@/server/auth/auth";
import { saveAnamneseSchema } from "@/server/modules/anamnese/anamnese.schema";
import { salvarAnamneseCompleta } from "@/server/modules/anamnese/anamnese.service";
import { withErrorHandlingNoContext } from "@/server/shared/http";

export const POST = withErrorHandlingNoContext(async (request: Request) => {
  await requirePermission("pacientes:edit");
  const body = await request.json();
  const parsed = saveAnamneseSchema.parse(body);
  const saved = await salvarAnamneseCompleta({
    pacienteId: parsed.pacienteId,
    body: body ?? {},
    status: (body?.status as string | undefined) ?? "Rascunho",
  });
  return Response.json(saved, { status: 201 });
});
