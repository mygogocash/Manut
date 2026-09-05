import { Hono } from "hono";
import { PERMISSIONS } from "@nexora/contracts";
import { itOperationsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const itOperations = new Hono<AppEnv>().get(
  "/dashboard",
  requirePermission(
    PERMISSIONS.IT_DASHBOARD_VIEW,
    PERMISSIONS.IT_BILLING_VIEW,
    PERMISSIONS.IT_ACCESS_VIEW,
    PERMISSIONS.IT_ACCESS_MANAGE,
  ),
  async (c) => c.json(await itOperationsService.dashboard(c.var.db)),
);
