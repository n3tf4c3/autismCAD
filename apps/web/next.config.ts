import type { NextConfig } from "next";

// Achado 132: o browser fala direto com o R2 (PUT presignado no upload, GET presignado na
// leitura de anexo/foto), entao o host do bucket precisa entrar em connect-src/img-src.
// Resolvido em tempo de build a partir das mesmas variaveis que o servidor usa; trocar o
// endpoint do R2 exige rebuild, nao so mudar a env var.
function r2Origin(): string {
  const endpoint = process.env.R2_ENDPOINT?.trim();
  if (endpoint) {
    try {
      return new URL(endpoint).origin;
    } catch {
      // Endpoint malformado cai no coringa abaixo; env.ts valida de verdade no boot.
    }
  }
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  return accountId
    ? `https://${accountId}.r2.cloudflarestorage.com`
    : "https://*.r2.cloudflarestorage.com";
}

// Achado 132: CSP em modo enforce. 'unsafe-inline' segue necessario em script-src (runtime
// inline do Next) e style-src — trocar por nonce exigiria middleware em todas as rotas, o
// que tornaria dinamicas as paginas hoje estaticas (landing, /login, /privacidade).
// Decisao registrada em docs/seguranca-decisoes-auditoria.md. O que a politica ja fecha e o
// vetor que importa aqui: exfiltracao de prontuario (connect-src/form-action travados em
// 'self' + R2) e clickjacking (frame-ancestors 'none').
function contentSecurityPolicy(): string {
  const r2 = r2Origin();
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `img-src 'self' data: blob: ${r2}`,
    `connect-src 'self' ${r2}`,
    // Mapa da landing publica.
    "frame-src https://www.google.com",
  ].join("; ");
}

const nextConfig: NextConfig = {
  transpilePackages: ["@autismcad/shared", "@autismcad/validators", "@autismcad/db"],
  // Achado 128: headers de seguranca em todas as respostas. HSTS e responsabilidade do host
  // (Vercel, max-age=63072000). Achado 132: CSP incluida.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
