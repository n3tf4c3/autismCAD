import { z } from "zod";
import { idParamSchema, parseJsonBody } from "@/lib/zod/api";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { db } from "@/db";
import { pacientes } from "@/server/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { AppError, toAppError } from "@/server/shared/errors";
import { jsonError } from "@/server/shared/http";
import { buildObjectKey, createSignedWriteUrl } from "@/server/storage/r2";

export const runtime = "nodejs";

const bodySchema = z.object({
  kind: z.enum(["foto", "laudo", "documento"]),
  filename: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(1).max(120),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { user } = await requirePermission("pacientes:edit");
    const { id: pacienteId } = idParamSchema.parse(await context.params);
    await assertPacienteAccess(user, pacienteId);

    const input = await parseJsonBody(request, bodySchema);

    const [row] = await db
      .select({ id: pacientes.id })
      .from(pacientes)
      .where(and(eq(pacientes.id, pacienteId), isNull(pacientes.deletedAt)))
      .limit(1);
    if (!row) throw new AppError("Paciente nao encontrado", 404, "NOT_FOUND");

    const prefix = `pacientes/${pacienteId}/${input.kind}`;
    const key = buildObjectKey(prefix, input.filename);
    const url = await createSignedWriteUrl({ key, contentType: input.contentType, expiresInSeconds: 300 });

    return Response.json({ key, url, expiresInSeconds: 300 });
  } catch (error) {
    return jsonError(toAppError(error));
  }
}

