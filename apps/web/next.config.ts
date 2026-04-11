import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@pulsorclip/core"],
  output: "export",
};

export default nextConfig;
