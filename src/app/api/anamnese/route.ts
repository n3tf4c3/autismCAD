import { requirePermission } from "@/server/auth/auth";
import { saveAnamneseSchema } from "@/server/modules/anamnese/anamnese.schema";
import { salvarAnamneseCompleta } from "@/server/modules/anamnese/anamnese.service";
import { toAppError } from "@/server/shared/errors";
import { jsonError } from "@/server/shared/http";

export async function POST(request: Request) {
  try {
    await requirePermission("pacientes:edit");
    const body = await request.json();
    const parsed = saveAnamneseSchema.parse(body);
    const saved = await salvarAnamneseCompleta({
      pacienteId: parsed.pacienteId,
      body: body ?? {},
      status: (body?.status as string | undefined) ?? "Rascunho",
    });
    return Response.json(saved, { status: 201 });
  } catch (error) {
    return jsonError(toAppError(error));
  }
}
