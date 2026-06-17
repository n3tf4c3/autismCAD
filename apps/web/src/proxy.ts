import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveCorsAllowOrigin } from "@/lib/api/cors-origin";

// CORS apenas para a API mobile (/api/v1/*). Autenticacao e por Bearer (sem cookies).
// O app Expo nativo nao envia Origin (CORS irrelevante); isto serve Expo web/dev e tooling.
// Achado 106: em producao nao emitimos "*" por padrao — exige API_V1_CORS_ORIGIN explicito.
const ALLOW_ORIGIN = resolveCorsAllowOrigin({
  configured: process.env.API_V1_CORS_ORIGIN,
  isProduction: process.env.NODE_ENV === "production",
});

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
  ...(ALLOW_ORIGIN ? { "Access-Control-Allow-Origin": ALLOW_ORIGIN } : {}),
};

export function proxy(request: NextRequest) {
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: "/api/v1/:path*",
};
