import type { NextConfig } from "next";

const apiBackend = (process.env.API_URL ?? "http://localhost:3001").replace(
  /\/+$/,
  "",
);

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@manut/types", "@manut/utils"],
  eslint: { ignoreDuringBuilds: true },
  env: {
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL ?? apiBackend,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  async rewrites() {
    return [
      // PostHog ingestion proxy — masks behind same-origin /ingest/* so adblockers
      // (uBlock, Brave Shields, AdGuard) can't drop product analytics requests.
      // Region: US Cloud. Swap to eu-assets / eu.i.posthog.com for EU Cloud.
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/decide",
        destination: "https://us.i.posthog.com/decide",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
      {
        source: "/api/:path*",
        destination: `${apiBackend}/api/:path*`,
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
