import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    return [
      {
        source: "/design-style-guide",
        destination: "/style-guide/index.html",
      },
      {
        source: "/crimson-admin-control/:path*",
        destination: "/admin/:path*",
      },
    ];
  },
};

export default nextConfig;
