import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// CORS apenas para a API mobile (/api/v1/*). Autenticacao e por Bearer (sem cookies),
// entao origem coringa e segura; restrinja via API_V1_CORS_ORIGIN em producao se desejar.
// O app Expo nativo nao envia Origin (CORS irrelevante); isto serve Expo web/dev e tooling.
const ALLOW_ORIGIN = process.env.API_V1_CORS_ORIGIN ?? "*";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
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
