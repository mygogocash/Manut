/**
 * Same-origin Express bridge for the single Vercel project (Root = apps/web).
 *
 * Must live under `src/pages` alongside `src/app` (Next.js rule).
 *
 * Loads a pre-bundled CJS build of the API (`src/server/vercel-api.cjs`) via
 * Node's createRequire so webpack never sees a dynamic `require(variable)`
 * ("expression is too dynamic") and does not try to re-bundle the  API.
 * The file is produced by `scripts/bundle-api-for-vercel.mjs` during build.
 *
 * Local `next dev` still uses next.config rewrites → localhost:3001.
 */
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");

// Node's createRequire, not webpack/turbopack `require` — those reject
// `require(variable)` with "expression is too dynamic".
const nodeRequire = Module.createRequire(__filename);

const BUNDLE_CANDIDATES = [
  // Vercel / next start: cwd is apps/web
  path.join(process.cwd(), "src", "server", "vercel-api.cjs"),
  // Relative to this file: src/pages/api → src/server
  path.join(__dirname, "..", "..", "server", "vercel-api.cjs"),
];

const bundleEntry = BUNDLE_CANDIDATES.find((p) => fs.existsSync(p));

/** @type {import("express").Application | null} */
let cachedApp = null;
/** @type {Error | null} */
let cachedLoadError = null;

function getApp() {
  if (cachedApp) return cachedApp;
  if (cachedLoadError) throw cachedLoadError;

  if (!bundleEntry) {
    cachedLoadError = new Error(
      `Intranet API bundle not found. Run scripts/bundle-api-for-vercel.mjs. Tried:\n${BUNDLE_CANDIDATES.join("\n")}`,
    );
    throw cachedLoadError;
  }

  try {
    const mod = nodeRequire(bundleEntry);
    cachedApp = typeof mod === "function" ? mod : mod.default;
    return cachedApp;
  } catch (err) {
    cachedLoadError = err instanceof Error ? err : new Error(String(err));
    throw cachedLoadError;
  }
}

function handler(req, res) {
  try {
    return getApp()(req, res);
  } catch (err) {
    console.error("[api bridge]", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          error: {
            code: "API_BRIDGE_FAILED",
            message: err instanceof Error ? err.message : "API bridge failed",
          },
        }),
      );
    }
  }
}

handler.config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

module.exports = handler;
