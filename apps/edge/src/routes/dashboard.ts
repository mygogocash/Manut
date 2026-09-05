import { Hono } from "hono";
import { PERMISSIONS } from "@nexora/contracts";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

/**
 * Dashboard stats skeleton. Notification-bell groups (approval / urgent /
 * survey / it-crm / news) are filled as source modules land; the empty
 * envelope keeps the Expo shell rendering without 404s.
 */
export const dashboard = new Hono<AppEnv>().get(
  "/stats",
  requirePermission(PERMISSIONS.HOME_READ),
  async (c) => {
    const user = c.var.user!;
    return c.json({
      user: { id: user.id, name: user.name, email: user.email },
      notifications: {
        approval: [],
        urgent: [],
        survey: [],
        "it-crm": [],
        news: [],
      },
      pendingActions: [],
      urgentItems: [],
    });
  },
);
