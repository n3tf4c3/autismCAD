import { withErrorHandlingNoContext } from "@/server/shared/http";

// Achado 67: liveness publico — confirma apenas que o processo esta no ar, sem
// tocar o banco. Checagens de readiness/conectividade de banco devem ser internas
// e protegidas por segredo, separadas deste endpoint.
export const GET = withErrorHandlingNoContext(async () => {
  return Response.json({ ok: true, service: "autismcad-api" });
});
