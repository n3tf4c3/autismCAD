import { requireApiUser } from "@/server/auth/api-auth";
import type { ClinicTimeResponse } from "@autismcad/validators/api/v1";
import { ymdNowInClinicTz } from "@/server/shared/clock";
import { withErrorHandlingNoContext } from "@/server/shared/http";

export const runtime = "nodejs";

// Achado 77: fonte de verdade da data "hoje" da clinica (fuso do servidor), para o
// mobile nao depender do relogio/fuso do aparelho ao escolher o dia padrao.
export const GET = withErrorHandlingNoContext(async (request: Request) => {
  await requireApiUser(request);
  return Response.json({ today: ymdNowInClinicTz() } satisfies ClinicTimeResponse);
});
