import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle (.next/standalone) for the Docker image.
  output: "standalone",
  // Allows dev-only assets (fonts, HMR) to load when browsing via the
  // Astrill VPN interface IP instead of localhost. Astrill assigns from the
  // 198.18.0.0/15 block, which changes rapidly, so wildcard the last two
  // octets instead of hardcoding one IP.
  allowedDevOrigins: ["198.18.*.*", "198.19.*.*"],
};

export default nextConfig;
