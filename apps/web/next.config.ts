import path from "node:path";

import type { NextConfig } from "next";

const apiBackend = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // Cloud Run / Docker need standalone. Vercel must not use it — Next 16.3 +
  // Vercel's onBuildComplete adapter fails with ENOENT next-server.js.nft.json
  // when both `output: "standalone"` and NEXT_ADAPTER_PATH are set
  // (vercel/next.js#96646). VERCEL is injected automatically on their builders.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  /**
   * Monorepo root, not apps/web. Next traces the files the standalone bundle
   * needs starting from this root; left to infer it, it picks the wrong one
   * when several lockfiles are visible and silently omits transitive deps —
   * Next 16 shipped without @swc/helpers, and the container died at boot with
   * "Cannot find module .../@swc/helpers/esm/_interop_require_default.js".
   */
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Pull the pre-bundled Express API + Prisma engines into the /api function.
  outputFileTracingIncludes: {
    "/api/**": [
      "./src/server/vercel-api.cjs",
      "./src/server/*.node",
      "./src/server/*.wasm",
      "./src/generated/prisma/*.node",
      "./src/generated/prisma/*.wasm",
    ],
  },
  transpilePackages: ["@nexora/ui", "@nexora/types", "@nexora/utils"],
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
  async redirects() {
    return [
      // The ARIA Revenue module was retired 2026-08-26: its deals migrated
      // onto the Sales CRM board tagged `aria` (revenue_* tables parked, not
      // dropped). Old bookmarks land on the view that now holds the data.
      {
        source: "/sales-revenue/:path*",
        destination: "/sales?tab=pipeline&bu=aria",
        permanent: false,
      },
      // Validator Monitor moved out of the IT Helpdesk tab strip and into the
      // IT workspace as its own surface. Matched on the query so the other
      // Helpdesk tabs are untouched; without it a bookmarked link lands on a
      // tab value that no longer exists and renders an empty panel rather
      // than an error.
      {
        source: "/it-helpdesk",
        has: [{ type: "query", key: "tab", value: "validator-monitor" }],
        destination: "/it-crm/validator-monitor",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    const rules = [
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
    ];

    // On Vercel, src/pages/api/[[...path]].js mounts Express in-process — do not
    // rewrite /api to localhost (DNS_HOSTNAME_RESOLVED_PRIVATE) or an external
    // host. Locally, proxy to the standalone API on :3001.
    if (!process.env.VERCEL) {
      rules.push({
        source: "/api/:path*",
        destination: `${apiBackend}/api/:path*`,
      });
    }

    return rules;
  },
  async headers() {
    return [
      {
        // The worker script must never be served from a stale HTTP cache, or a
        // deploy cannot reach clients: the browser would keep revalidating an
        // old copy and the update handshake would never fire. Browsers cap
        // worker-script caching at 24h anyway; this makes it immediate.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          // The worker sits at the root, so root scope needs no widening — this
          // is belt-and-braces against the file ever moving into a subdirectory.
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // Correct type matters: some browsers refuse to parse a manifest served
        // as text/plain, and installability then fails with no visible reason.
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json; charset=utf-8",
          },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
      {
        // Icons change only when the brand does.
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
