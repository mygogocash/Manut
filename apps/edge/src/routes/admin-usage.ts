import { Hono } from "hono";
import { PERMISSIONS } from "@nexora/contracts";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

function notImplemented(message: string) {
  return (c: { json: (body: unknown, status?: number) => Response }) =>
    c.json({ error: { code: "NOT_IMPLEMENTED", message } }, 501);
}

export const adminUsage = new Hono<AppEnv>()
  .get("/totals", requirePermission(PERMISSIONS.ADMIN_USAGE_REPORT), notImplemented("Usage totals require Supabase storage APIs (Node-only)"))
  .get("/storage", requirePermission(PERMISSIONS.ADMIN_USAGE_REPORT), notImplemented("Usage storage report requires Supabase storage APIs (Node-only)"))
  .get("/buckets", requirePermission(PERMISSIONS.ADMIN_USAGE_REPORT), notImplemented("Bucket health requires Supabase storage APIs (Node-only)"))
  .get("/activity", requirePermission(PERMISSIONS.ADMIN_USAGE_REPORT), notImplemented("Usage activity report requires PostHog/Node (Node-only)"));
