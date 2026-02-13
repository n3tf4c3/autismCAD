import { z } from "zod";
import { idParamSchema, parseJsonBody } from "@/lib/zod/api";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { pacientes } from "@/server/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { AppError, toAppError } from "@/server/shared/errors";
import { jsonError } from "@/server/shared/http";
import { deleteObjectFromR2 } from "@/server/storage/r2";
import { runDbTransaction } from "@/server/db/transaction";

export const runtime = "nodejs";

const bodySchema = z.object({
  kind: z.enum(["foto", "laudo", "documento"]),
  key: z.string().trim().min(1).max(255).nullable(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

function looksLikeR2Key(value: string): boolean {
  const v = value.trim().toLowerCase();
  return !v.startsWith("http://") && !v.startsWith("https://");
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { user } = await requirePermission("pacientes:edit");
    const { id: pacienteId } = idParamSchema.parse(await context.params);
    await assertPacienteAccess(user, pacienteId);

    const input = await parseJsonBody(request, bodySchema);

    const { previousKey } = await runDbTransaction(async (tx) => {
      const [row] = await tx
        .select({
          id: pacientes.id,
          foto: pacientes.foto,
          laudo: pacientes.laudo,
          documento: pacientes.documento,
        })
        .from(pacientes)
        .where(and(eq(pacientes.id, pacienteId), isNull(pacientes.deletedAt)))
        .limit(1);
      if (!row) throw new AppError("Paciente nao encontrado", 404, "NOT_FOUND");

      const prev =
        input.kind === "foto"
          ? row.foto
          : input.kind === "laudo"
            ? row.laudo
            : row.documento;

      if (input.kind === "foto") {
        await tx
          .update(pacientes)
          .set({ foto: input.key, updatedAt: sql`now()` })
          .where(eq(pacientes.id, pacienteId));
      } else if (input.kind === "laudo") {
        await tx
          .update(pacientes)
          .set({ laudo: input.key, updatedAt: sql`now()` })
          .where(eq(pacientes.id, pacienteId));
      } else {
        await tx
          .update(pacientes)
          .set({ documento: input.key, updatedAt: sql`now()` })
          .where(eq(pacientes.id, pacienteId));
      }

      return { previousKey: prev };
    });

    if (
      previousKey &&
      previousKey !== input.key &&
      looksLikeR2Key(previousKey)
    ) {
      // Best-effort cleanup.
      await deleteObjectFromR2(previousKey).catch(() => null);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(toAppError(error));
  }
}
