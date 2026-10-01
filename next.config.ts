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
  async headers() {
    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self' data: https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
      "connect-src 'self' https://*.supabase.co https://va.vercel-scripts.com https://vitals.vercel-insights.com",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
        ],
      },
    ];
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
