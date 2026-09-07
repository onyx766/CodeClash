import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows dev-only assets (fonts, HMR) to load when browsing via the
  // Astrill VPN interface IP instead of localhost.
  allowedDevOrigins: ["198.18.9.78"],
};

export default nextConfig;
