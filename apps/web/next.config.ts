import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@autismcad/shared", "@autismcad/validators", "@autismcad/db"],
  // Achado 128: headers de seguranca em todas as respostas. CSP fica para um passo
  // futuro (exige ajuste fino com o Next); HSTS e responsabilidade do host.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
