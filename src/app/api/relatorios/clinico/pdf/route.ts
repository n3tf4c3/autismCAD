import { ZodError } from "zod";
import { Buffer } from "node:buffer";
import { requirePermission } from "@/server/auth/auth";
import { clinicoQuerySchema } from "@/server/modules/relatorios/relatorios.schema";
import { consolidateClinicoReport } from "@/server/modules/relatorios/relatorios.service";
import { buildClinicoPdf, type ClinicoReport } from "@/server/modules/relatorios/clinico-pdf";
import { toAppError } from "@/server/shared/errors";

function parseQuery(url: string) {
  const search = new URL(url).searchParams;
  return clinicoQuerySchema.parse({
    pacienteId: search.get("pacienteId"),
    version: search.get("version") ?? undefined,
    from: search.get("from") ?? undefined,
    to: search.get("to") ?? undefined,
    terapeutaId: search.get("terapeutaId") ?? undefined,
  });
}

export async function GET(request: Request) {
  try {
    const { user } = await requirePermission("relatorios_clinicos:export");
    const query = parseQuery(request.url);
    const report = await consolidateClinicoReport({ query, user });
    const bytes = await buildClinicoPdf(report as unknown as ClinicoReport);
    const body = Buffer.from(bytes);

    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": "inline; filename=\"relatorio-clinico.pdf\"",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Filtro invalido" }, { status: 400 });
    }
    const err = toAppError(error);
    return Response.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

