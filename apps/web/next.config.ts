import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@autismcad/shared", "@autismcad/validators", "@autismcad/db"],
};

export default nextConfig;
