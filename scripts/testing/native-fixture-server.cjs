// API exclusivamente sintetica para smoke nativo em emulador descartavel.
// Nao importa db/env/auth da aplicacao, nao grava dados e nunca chama upstream.
const http = require("node:http");
if (process.env.AUDIT_NATIVE_FIXTURE !== "1") throw new Error("Exige AUDIT_NATIVE_FIXTURE=1");
const user = { id: 1, nome: "Auditoria Sintetica", email: "audit@example.invalid", role: "PROFISSIONAL", consentRequired: false };
const tokens = { accessToken: "synthetic-access-only", refreshToken: "synthetic-refresh-only", expiresIn: 3600, user };
let expired = false, refreshes = 0;
const server = http.createServer(async (request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  let data;
  if (path === "/api/v1/auth/login") data = tokens;
  else if (path === "/api/v1/auth/refresh") { refreshes++; expired = false; data = tokens; }
  else if (path === "/api/v1/auth/logout") data = { ok: true };
  else if (path === "/fixture/expire") { expired = true; data = { ok: true }; }
  else if (path === "/fixture/status") data = { refreshes };
  else if (expired) { response.statusCode = 401; data = { error: "Synthetic expired", code: "TOKEN_REVOKED" }; }
  else if (path === "/api/v1/time") data = { today: "2026-09-05" };
  else if (path === "/api/v1/atendimentos") data = { items: [] };
  else { response.statusCode = 404; data = { error: "Fixture route not implemented" }; }
  console.log(JSON.stringify({ method: request.method, path, status: response.statusCode }));
  response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify(data));
});
server.listen(3107, "127.0.0.1", () => console.log("Synthetic native fixture on 127.0.0.1:3107"));
