import type { NextConfig } from "next";

// Security headers for every page. No third-party scripts are allowed, which
// also keeps ad pixels off health-related pages.
const securityHeaders = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // The dev server needs eval for fast refresh, so the strict policy applies to production builds.
  ...(process.env.NODE_ENV === "production" ? [] : [{ key: "X-Dev-Mode", value: "1" }]),
  {
    key: process.env.NODE_ENV === "production" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
    value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Credential documents can be up to 10 MB.
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
