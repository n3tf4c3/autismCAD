import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@autismcad/shared", "@autismcad/validators"],
};

export default nextConfig;
