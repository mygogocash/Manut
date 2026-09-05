/**
 * Must be imported before `@/app` so PrismaClient sees the engine path.
 *
 * After esbuild, `__dirname` is `apps/web/src/server` (next to vercel-api.cjs
 * and the copied `libquery_engine-*.node` files). On Vercel, cwd search
 * paths baked into the generated client (`src/generated/prisma/...`) are
 * wrong, so we set PRISMA_QUERY_ENGINE_LIBRARY explicitly.
 *
 * Keep this file free of `@/` app imports so it evaluates before PrismaClient.
 */
import { existsSync } from "node:fs";
import path from "node:path";

function engineNamesForHost() {
  if (process.platform === "linux") {
    if (process.env.VERCEL) {
      return ["libquery_engine-rhel-openssl-3.0.x.so.node"];
    }
    return [
      "libquery_engine-rhel-openssl-3.0.x.so.node",
      "libquery_engine-debian-openssl-3.0.x.so.node",
    ];
  }
  if (process.platform === "darwin") {
    return [
      "libquery_engine-darwin-arm64.dylib.node",
      "libquery_engine-darwin.dylib.node",
    ];
  }
  return [
    "libquery_engine-rhel-openssl-3.0.x.so.node",
    "libquery_engine-debian-openssl-3.0.x.so.node",
    "libquery_engine-darwin-arm64.dylib.node",
    "libquery_engine-darwin.dylib.node",
  ];
}

function pinPrismaEngine() {
  if (process.env.PRISMA_QUERY_ENGINE_LIBRARY) return;

  const searchDirs = [
    __dirname,
    path.join(process.cwd(), "src", "server"),
    path.join(process.cwd(), "src", "generated", "prisma"),
    path.join(process.cwd(), "apps", "web", "src", "server"),
  ];

  for (const dir of searchDirs) {
    for (const name of engineNamesForHost()) {
      const candidate = path.join(dir, name);
      if (existsSync(candidate)) {
        process.env.PRISMA_QUERY_ENGINE_LIBRARY = candidate;
        console.info("[prisma] pinned query engine", candidate);
        return;
      }
    }
  }

  console.error("[prisma] query engine binary not found", {
    cwd: process.cwd(),
    dirname: __dirname,
    searched: searchDirs,
  });
}

if (!process.env.DATABASE_URL) {
  console.error("[prisma] DATABASE_URL is not set — login will fail after auth");
}

pinPrismaEngine();
