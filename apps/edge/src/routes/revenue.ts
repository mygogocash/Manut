import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import { revenueQuerySchema } from "@nexora/contracts/modules/revenue/revenue.validation";
import { revenueService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const revenue = new Hono<AppEnv>()
  .get("/dashboard", requirePermission(PERMISSIONS.REVENUE_READ), zValidator("query", revenueQuerySchema), async (c) =>
    c.json({ data: await revenueService.getDashboard(c.var.db, c.req.valid("query")) }),
  )
  .get("/investments", requirePermission(PERMISSIONS.REVENUE_READ), zValidator("query", revenueQuerySchema), async (c) =>
    c.json({ data: await revenueService.getInvestments(c.var.db, c.req.valid("query")) }),
  )
  .get("/expenses", requirePermission(PERMISSIONS.REVENUE_READ), zValidator("query", revenueQuerySchema), async (c) =>
    c.json({ data: await revenueService.getExpenses(c.var.db, c.req.valid("query")) }),
  )
  .get("/invoices", requirePermission(PERMISSIONS.REVENUE_READ), zValidator("query", revenueQuerySchema), async (c) =>
    c.json({ data: await revenueService.getInvoices(c.var.db, c.req.valid("query")) }),
  );
