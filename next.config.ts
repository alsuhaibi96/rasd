import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["pg"],
  async headers() {
    return ["/geo/:file*", "/vendor/:path*"].map((source) => ({ source, headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] }));
  },
};

export default nextConfig;
