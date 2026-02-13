import { z } from "zod";
import { idParamSchema } from "@/lib/zod/api";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { db } from "@/db";
import { pacientes } from "@/server/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { AppError, toAppError } from "@/server/shared/errors";
import { jsonError } from "@/server/shared/http";
import { createSignedReadUrl } from "@/server/storage/r2";

export const runtime = "nodejs";

const kindSchema = z.enum(["foto", "laudo", "documento"]);

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { user } = await requirePermission("pacientes:view");
    const { id: pacienteId } = idParamSchema.parse(await context.params);
    await assertPacienteAccess(user, pacienteId);

    const search = new URL(request.url).searchParams;
    const kind = kindSchema.parse(search.get("kind") ?? "");

    const [row] = await db
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

    const key =
      kind === "foto"
        ? row.foto
        : kind === "laudo"
          ? row.laudo
          : row.documento;

    if (!key) {
      return Response.json({ url: null, key: null });
    }

    // If stored value is already a URL, return it as-is (compat with legacy).
    if (/^https?:\/\//i.test(key)) {
      return Response.json({ url: key, key });
    }

    const url = await createSignedReadUrl(key, 300);
    return Response.json({ url, key, expiresInSeconds: 300 });
  } catch (error) {
    return jsonError(toAppError(error));
  }
}

