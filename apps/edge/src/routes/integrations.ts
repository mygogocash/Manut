import { Hono } from "hono";
import { PERMISSIONS } from "@nexora/contracts";
import { integrationsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

function notImplemented(message: string) {
  return (c: { json: (body: unknown, status?: number) => Response }) =>
    c.json({ error: { code: "NOT_IMPLEMENTED", message } }, 501);
}

export const integrations = new Hono<AppEnv>()
  .get("/status", requirePermission(PERMISSIONS.INTEGRATIONS_USE), async (c) =>
    c.json({
      data: await integrationsService.getStatus(c.var.db, c.var.user!.id, {
        GOOGLE_OAUTH_CLIENT_ID: c.env.GOOGLE_OAUTH_CLIENT_ID,
        GOOGLE_OAUTH_CLIENT_SECRET: c.env.GOOGLE_OAUTH_CLIENT_SECRET,
        ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY,
      }),
    }),
  )
  .get("/google/oauth-start", requirePermission(PERMISSIONS.INTEGRATIONS_USE), notImplemented("Google OAuth start requires Node redirect flow"))
  .get("/google/oauth-callback", notImplemented("Google OAuth callback requires Node redirect flow"))
  .delete("/google", requirePermission(PERMISSIONS.INTEGRATIONS_USE), notImplemented("Google disconnect requires token refresh (Node-only)"))
  .post("/gmail/list", requirePermission(PERMISSIONS.INTEGRATIONS_USE), notImplemented("Gmail list requires Google API client (Node-only)"))
  .get("/gmail/labels", requirePermission(PERMISSIONS.INTEGRATIONS_USE), notImplemented("Gmail labels requires Google API client (Node-only)"))
  .post("/gmail/modify", requirePermission(PERMISSIONS.INTEGRATIONS_USE), notImplemented("Gmail modify requires Google API client (Node-only)"))
  .post("/gmail/trash", requirePermission(PERMISSIONS.INTEGRATIONS_USE), notImplemented("Gmail trash requires Google API client (Node-only)"))
  .post("/gmail/untrash", requirePermission(PERMISSIONS.INTEGRATIONS_USE), notImplemented("Gmail untrash requires Google API client (Node-only)"))
  .get("/google/probe", requirePermission(PERMISSIONS.INTEGRATIONS_USE), notImplemented("Google probe requires live token fetch (Node-only)"))
  .post("/gmail/read", requirePermission(PERMISSIONS.INTEGRATIONS_USE), notImplemented("Gmail read requires Google API client (Node-only)"))
  .post("/gmail/send", requirePermission(PERMISSIONS.INTEGRATIONS_USE), notImplemented("Gmail send requires Google API client (Node-only)"))
  .post("/drive/list", requirePermission(PERMISSIONS.INTEGRATIONS_USE), notImplemented("Drive list requires Google API client (Node-only)"));
