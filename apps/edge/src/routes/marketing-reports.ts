import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { PERMISSIONS } from "@nexora/contracts";
import { marketingReportsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

const dashboardQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
  telco: z.string().optional(),
});

export const marketingReports = new Hono<AppEnv>()
  .get("/dashboard", requirePermission(PERMISSIONS.MARKETING_REPORTS_VIEW), zValidator("query", dashboardQuery), async (c) =>
    c.json(await marketingReportsService.dashboard(c.var.db, c.req.valid("query"))),
  );
