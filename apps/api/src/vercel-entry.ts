/**
 * Vercel / Next pages-API entry. Loaded via the pre-bundled
 * `apps/web/src/server/vercel-api.cjs` (see scripts/bundle-api-for-vercel.mjs).
 */
import "@/pin-prisma-engine";
import "@/env";

import app from "@/app";

export default app;
