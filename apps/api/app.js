/**
 * Express entry for Vercel.
 *
 * Primary deploy: single project Root Directory `apps/web` mounts this via
 * `src/pages/api/[[...path]].js` (same-origin `/api/*`).
 * Optional: separate project Root Directory `apps/api` using this file directly.
 *
 * Boots through `tsx` so `@/*` path aliases and workspace `.ts` packages
 * resolve the same way as `pnpm dev`. Socket.IO is not available here.
 */
const path = require("node:path");

// When required from apps/web/pages/api, cwd is the web app — pin tsx to
// this package's tsconfig so `@/*` resolves under apps/api/src.
process.env.TSX_TSCONFIG_PATH = path.join(__dirname, "tsconfig.json");

require("tsx/cjs/api").register();
require("./src/env");
module.exports = require("./src/app").default;
