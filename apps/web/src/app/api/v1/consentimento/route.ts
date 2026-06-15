import { requireApiUser } from "@/server/auth/api-auth";
import { acceptCurrentPolicy } from "@/server/modules/consent/consent.service";
import { withErrorHandlingNoContext } from "@/server/shared/http";

export const runtime = "nodejs";

// Registra o aceite da Política de Privacidade vigente para o usuário do token Bearer.
export const POST = withErrorHandlingNoContext(async (request: Request) => {
  const { user } = await requireApiUser(request);
  await acceptCurrentPolicy(Number(user.id));
  return Response.json({ ok: true });
});
